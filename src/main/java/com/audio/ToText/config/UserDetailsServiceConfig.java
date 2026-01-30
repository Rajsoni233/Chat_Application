package com.audio.ToText.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.*;

import com.audio.ToText.Repository.UserRepository;

@Configuration
public class UserDetailsServiceConfig {

    private final UserRepository userRepository;

    public UserDetailsServiceConfig(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // Spring Security will use this method for login
    @Bean
    public UserDetailsService userDetailsService() {
        return username ->   // NOTE: "username" = email from login form
                userRepository.findByEmail(username)
                        .map(u -> User.withUsername(u.getEmail())   // email used as username
                                .password(u.getPassword())
                                .roles("USER")
                                .build())
                        .orElseThrow(() ->
                                new UsernameNotFoundException("User not found with email: " + username)
                        );
    }
}
