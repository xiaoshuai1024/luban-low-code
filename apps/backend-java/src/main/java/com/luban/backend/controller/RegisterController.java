package com.luban.backend.controller;

import com.luban.backend.dto.RegisterRequest;
import com.luban.backend.dto.RegisterResendRequest;
import com.luban.backend.dto.RegisterResendResponse;
import com.luban.backend.dto.RegisterResponse;
import com.luban.backend.dto.RegisterVerifyRequest;
import com.luban.backend.dto.RegisterVerifyResponse;
import com.luban.backend.entity.EmailVerification;
import com.luban.backend.service.EmailVerificationService;
import com.luban.backend.service.RegisterService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 自助注册三端点（T-be-2；AuthFilter NO_AUTH_PATHS 白名单，BFF 侧另有 IP 限流）。
 *
 * verify 的两步编排：先 EmailVerificationService.verify（失败计数独立落库），
 * 再 RegisterService.activateVerifiedUser（激活单事务）——见 RegisterService javadoc。
 */
@RestController
@RequestMapping("/auth/register")
public class RegisterController {

    private final RegisterService registerService;
    private final EmailVerificationService emailVerificationService;

    public RegisterController(RegisterService registerService,
                              EmailVerificationService emailVerificationService) {
        this.registerService = registerService;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(registerService.register(req.username(), req.email(), req.password()));
    }

    @PostMapping("/verify")
    public ResponseEntity<RegisterVerifyResponse> verify(@Valid @RequestBody RegisterVerifyRequest req) {
        EmailVerification verification = emailVerificationService.verify(req.email(), req.code());
        return ResponseEntity.ok(registerService.activateVerifiedUser(req.email(), verification.getId()));
    }

    @PostMapping("/resend")
    public ResponseEntity<RegisterResendResponse> resend(@Valid @RequestBody RegisterResendRequest req) {
        return ResponseEntity.ok(registerService.resend(req.email()));
    }
}
