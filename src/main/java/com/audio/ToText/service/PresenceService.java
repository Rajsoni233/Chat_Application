package com.audio.ToText.service;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final Map<String, String> sessions = new ConcurrentHashMap<>();

    public void add(String sessionId, String username) {
        if (sessionId != null && username != null) {
            sessions.put(sessionId, username.trim());
        }
    }

    public void remove(String sessionId) {
        if (sessionId != null) {
            sessions.remove(sessionId);
        }
    }

    public List<String> listUsers() {
        return new ArrayList<>(new LinkedHashSet<>(sessions.values()));
    }
}
