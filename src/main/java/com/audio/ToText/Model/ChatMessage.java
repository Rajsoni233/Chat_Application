package com.audio.ToText.Model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    public enum MessageType {
        TEXT,
        FILE,
        TYPING   // used for typing indicator
    }
    
    private MessageType type;
    private String sender;    // who sent the message
    private String content;   // text content

    private String to;        // ✅ target user for private messages (null = global)

    private String fileUrl;   // for FILE type
    private Instant timestamp;
}
