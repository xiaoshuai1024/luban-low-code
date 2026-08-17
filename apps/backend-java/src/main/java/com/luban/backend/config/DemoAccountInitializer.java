package com.luban.backend.config;

import com.luban.backend.entity.User;
import com.luban.backend.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * 内置体验账号初始化（幂等，每次启动自愈）。
 *
 * 提供公开体验账号 test / test（role=user，可创建测试站点与页面），
 * 供官网/登录页引导体验者直接登录。密码哈希用应用自身 PasswordEncoder
 * 生成，保证与登录校验编码器一致（不硬编码哈希值，避免编码器参数漂移）。
 *
 * 行为：
 *  - 用户不存在 → 插入；
 *  - 已存在但密码不是 test（哈希不匹配）→ 重置为 test，保证体验入口始终可用；
 *  - 已存在且密码正确 → 不动（管理员改过的 name/role/status 不覆盖）。
 *
 * <p>条件装配：{@code app.demo-account.enabled=false}（env {@code APP_DEMO_ACCOUNT_ENABLED}）
 * 时整个初始化器不加载——生产 compose 显式置 false（无内置体验账号），本地/测试默认开启
 * （matchIfMissing=true，与收编前的无条件行为保持一致）。
 */
@Component
@ConditionalOnProperty(name = "app.demo-account.enabled", havingValue = "true", matchIfMissing = true)
public class DemoAccountInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountInitializer.class);

    static final String DEMO_USERNAME = "test";
    static final String DEMO_PASSWORD = "test";

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public DemoAccountInitializer(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        User existing = userMapper.findByUsername(DEMO_USERNAME);
        if (existing == null) {
            User u = new User();
            u.setId(UUID.randomUUID().toString());
            u.setUsername(DEMO_USERNAME);
            u.setName("体验用户");
            u.setRole("user");
            u.setStatus("active");
            u.setPassword(passwordEncoder.encode(DEMO_PASSWORD));
            Instant now = Instant.now();
            u.setCreatedAt(now);
            u.setUpdatedAt(now);
            userMapper.insert(u);
            log.info("demo account '{}' created (role=user)", DEMO_USERNAME);
            return;
        }
        if (!passwordEncoder.matches(DEMO_PASSWORD, existing.getPassword())) {
            userMapper.updatePassword(existing.getId(), passwordEncoder.encode(DEMO_PASSWORD), Instant.now());
            log.info("demo account '{}' password reset to default", DEMO_USERNAME);
        }
    }
}
