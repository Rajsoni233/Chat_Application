package com.audio.ToText.Controller;

import com.audio.ToText.Model.ChatMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;

@Controller
public class ChatController {

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @MessageMapping("/sendMessage")
    public void handleSendMessage(ChatMessage message) {

        if (message.getSender() == null || message.getSender().isBlank()) {
            message.setSender("Anonymous");
        }
        if (message.getTimestamp() == null) {
            message.setTimestamp(Instant.now());
        }
        if (message.getType() == null) {
            message.setType(ChatMessage.MessageType.TEXT);
        }

        // Optional: don't broadcast typing events as normal chat messages
        if (message.getType() == ChatMessage.MessageType.TYPING) {
            System.out.println("Typing event from: " + message.getSender());
            return;
        }

        if (messagingTemplate != null) {
            messagingTemplate.convertAndSend("/topic/messages", message);
            System.out.println("Broadcasting message: " + message.getSender() + " -> " + message.getContent());
        } else {
            System.out.println("SimpMessagingTemplate is NULL – WebSocket not configured yet");
        }
    }

    @GetMapping("/chat")
    public String chatPage() {
        return "Chat";   // templates/Chat.html
    }
@PostMapping(path = "/upload")
@ResponseBody
public ChatMessage handleFileUpload(@RequestParam("file") MultipartFile file,
                                    @RequestParam(value = "sender", required = false) String sender,
                                    @RequestParam(value = "to", required = false) String to) throws IOException {

    if (file == null || file.isEmpty()) {
        throw new IllegalArgumentException("File is required");
    }

    Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
    if (!Files.exists(uploadPath)) {
        Files.createDirectories(uploadPath);
    }

    String originalFilename = Paths.get(file.getOriginalFilename()).getFileName().toString();
    String storedFilename = System.currentTimeMillis() + "_" + originalFilename;
    Path destination = uploadPath.resolve(storedFilename);

    try {
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
    } catch (IOException e) {
        throw new IOException("Failed to store file", e);
    }

    String fileUrl = "/files/" + storedFilename;

    ChatMessage message = new ChatMessage();
    message.setType(ChatMessage.MessageType.FILE);
    message.setFileUrl(fileUrl);
    message.setSender((sender == null || sender.isBlank()) ? "Anonymous" : sender);
    message.setContent(originalFilename);
    message.setTimestamp(Instant.now());

    // ✅ Set recipient for private chat
    message.setTo(to); // null => global, non-null => private

    if (messagingTemplate != null) {
        messagingTemplate.convertAndSend("/topic/messages", message);
    } else {
        System.out.println("SimpMessagingTemplate is NULL – cannot broadcast file message");
    }

    return message;
}

}
