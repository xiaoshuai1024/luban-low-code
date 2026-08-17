package com.luban.backend.service;

import com.luban.backend.dto.LoginResponse;
import com.luban.backend.dto.UserResponse;
import com.luban.backend.entity.User;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.UserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    public LoginResponse login(String username, String password) {
        User u = userMapper.findByUsername(username);
        // 先统一校验密码（用户不存在/密码错误同响应，消除账号状态 oracle：
        // 错误密码不再暴露 pending_verification/disabled 等账号状态），通过后才判账号状态
        if (u == null || !passwordEncoder.matches(password, u.getPassword())) {
            throw BusinessException.invalidCredentials();
        }
        // 注册未验证邮箱：文案「邮箱未验证」引导回注册流程（plan §3.2 非法态）
        if ("pending_verification".equals(u.getStatus())) {
            throw BusinessException.userPendingVerification();
        }
        if (!"active".equals(u.getStatus())) {
            throw BusinessException.userDisabled();
        }
        return LoginResponse.of(UserResponse.fromEntity(u));
    }

    /**
     * Current user for /auth/me (by userId from UserContext). Returns full user from DB.
     */
    public UserResponse me(String userId) {
        User u = userMapper.getById(userId);
        if (u == null) {
            throw BusinessException.userNotFound();
        }
        return UserResponse.fromEntity(u);
    }
}
