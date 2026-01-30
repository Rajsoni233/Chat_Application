package com.audio.ToText.Repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import com.audio.ToText.Model.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
