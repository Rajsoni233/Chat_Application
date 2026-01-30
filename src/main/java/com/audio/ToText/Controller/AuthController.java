package com.audio.ToText.Controller;

import com.audio.ToText.Model.User;
import com.audio.ToText.Repository.UserRepository;
import com.audio.ToText.service.PasswordResetService;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@Controller
@RequestMapping("/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetService passwordResetService;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          PasswordResetService passwordResetService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordResetService = passwordResetService;
    }

    // ================== REGISTER ==================

    // Show register page
    @GetMapping("/register")
    public String registerPage() {
        return "register";   // register.html
    }

    // Handle register form submit
    @PostMapping("/register")
    public String register(@RequestParam String name,
                           @RequestParam String email,
                           @RequestParam String password,
                           Model model) {

        // ✅ Password rule: min 8 chars, 1 letter, 1 digit
        String pwdRegex = "^(?=.*[A-Za-z])(?=.*\\d).{8,}$";

        if (!password.matches(pwdRegex)) {
            model.addAttribute("error",
                    "Password must be at least 8 characters long and contain at least one letter and one number");
            model.addAttribute("name", name);
            model.addAttribute("email", email);
            return "register"; // stay on same page and show error
        }

        // ✅ Check if email already exists
        if (userRepository.existsByEmail(email)) {
            model.addAttribute("error", "User with this email already exists");
            model.addAttribute("name", name);
            model.addAttribute("email", email);
            return "register";
        }

        // ✅ Create and save user
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password)); // encode AFTER validation

        userRepository.save(user);

        // After success, go to login page
        return "redirect:/auth/login";
    }

    // ================== LOGIN ==================

    // Show login page
    @GetMapping("/login")
    public String loginPage() {
        return "login";   // login.html
    }

    // POST /login is handled by Spring Security (formLogin)

    // ================== FORGOT PASSWORD ==================

    @GetMapping("/forgot-password")
    public String showForgotPasswordPage() {
        return "forgot_password"; // forgot_password.html
    }

    @PostMapping("/forgot-password")
    public String handleForgotPassword(@RequestParam String email,
                                       Model model) {

        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isEmpty()) {
            model.addAttribute("error", "No account found with this email");
            model.addAttribute("email", email);
            return "forgot_password";
        }

        User user = userOpt.get();

        String token = passwordResetService.createPasswordResetToken(user);

        // In real app: send mail. For demo: print in console
        System.out.println("Password reset link: http://localhost:8080/auth/reset-password?token=" + token);

        model.addAttribute("message",
                "Password reset link has been sent to your email (check server console in this demo).");
        return "forgot_password";
    }

    // ================== RESET PASSWORD ==================

    @GetMapping("/reset-password")
    public String showResetPasswordForm(@RequestParam String token,
                                        Model model) {

        if (!passwordResetService.isValidToken(token)) {
            model.addAttribute("error", "Invalid or expired reset link");
            return "reset_password"; // will show error
        }

        model.addAttribute("token", token);
        return "reset_password";      // reset_password.html
    }

    @PostMapping("/reset-password")
    public String handleResetPassword(@RequestParam String token,
                                      @RequestParam String password,
                                      Model model) {

        boolean success = passwordResetService.resetPassword(token, password);

        if (!success) {
            model.addAttribute("error", "Invalid or expired reset link");
            model.addAttribute("token", token);
            return "reset_password";
        }

        // On success → go back to login
        return "redirect:/auth/login";
    }
}
