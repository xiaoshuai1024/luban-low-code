package com.luban.backend.config;

import com.luban.backend.entity.User;
import com.luban.backend.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * E2E 专用账号引导（幂等，仅在显式配置 env 时生效）。
 *
 * CI 的 e2e compose 栈使用全新数据库，auth.setup 需要预置的专用测试账号
 * （见 e2e/README.md：LUBAN_E2E_ACCOUNT / LUBAN_E2E_PASSWORD）。
 *
 * 与体验账号初始化不同：
 *  - 仅当 E2E_BOOTSTRAP_ACCOUNT / E2E_BOOTSTRAP_PASSWORD 均已配置时启用
 *    （生产不配置即完全不生效，无默认值回退）；
 *  - 账号已存在时不做任何重置（不覆盖密码，避免与 DemoAccountInitializer
 *    等既有机制相互改写）。
 */
@Component
public class E2EAccountBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(E2EAccountBootstrap.class);

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final String account;
    private final String password;

    public E2EAccountBootstrap(
            UserMapper userMapper,
            PasswordEncoder passwordEncoder,
            @Value("${E2E_BOOTSTRAP_ACCOUNT:}") String account,
            @Value("${E2E_BOOTSTRAP_PASSWORD:}") String password) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.account = account == null ? "" : account.trim();
        this.password = password == null ? "" : password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (account.isEmpty() || password.isEmpty()) {
            return; // 未配置即不启用（生产默认路径）
        }
        User existing = userMapper.findByUsername(account);
        if (existing != null) {
            log.info("e2e bootstrap account '{}' already exists, skip", account);
            return;
        }
        User u = new User();
        u.setId(UUID.randomUUID().toString());
        u.setUsername(account);
        u.setName("e2e-ci");
        u.setRole("admin");
        u.setStatus("active");
        u.setPassword(passwordEncoder.encode(password));
        Instant now = Instant.now();
        u.setCreatedAt(now);
        u.setUpdatedAt(now);
        userMapper.insert(u);
        log.info("e2e bootstrap account '{}' created (role=admin)", account);
    }
}
