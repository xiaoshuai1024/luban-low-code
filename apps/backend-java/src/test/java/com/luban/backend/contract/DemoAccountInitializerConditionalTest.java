package com.luban.backend.contract;

import com.luban.backend.config.DemoAccountInitializer;
import com.luban.backend.mapper.UserMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * T-be-8：DemoAccountInitializer 条件装配行为锁定。
 *
 *  - app.demo-account.enabled=false → bean 不加载（生产无内置体验账号）；
 *  - 未配置 / =true → bean 加载（本地/测试默认开启，matchIfMissing=true 与收编前行为一致）；
 *  - 默认 test profile 下 ApplicationRunner 真实执行：users 表存在 test 账号（role=user）。
 *
 * 装配矩阵用 ApplicationContextRunner 切片验证（不触发 ApplicationRunner、不污染共享 H2）；
 * 行为验证用完整 @SpringBootTest。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DemoAccountInitializerConditionalTest {

    @Autowired private JdbcTemplate jdbc;

    /** 最小依赖切片：DemoAccountInitializer 仅需 UserMapper + PasswordEncoder。 */
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(UserMapper.class, () -> Mockito.mock(UserMapper.class))
            .withBean(PasswordEncoder.class, BCryptPasswordEncoder::new)
            .withUserConfiguration(DemoAccountInitializer.class);

    @Test
    void disabledPropertyHidesInitializerBean() {
        runner.withPropertyValues("app.demo-account.enabled=false")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DemoAccountInitializer.class));
    }

    @Test
    void enabledPropertyLoadsInitializerBean() {
        runner.withPropertyValues("app.demo-account.enabled=true")
                .run(ctx -> assertThat(ctx).hasSingleBean(DemoAccountInitializer.class));
    }

    @Test
    void missingPropertyDefaultsToEnabled() {
        runner.run(ctx -> assertThat(ctx).hasSingleBean(DemoAccountInitializer.class));
    }

    /** 行为锁：默认（test profile 未配置该属性）时启动即自愈 test 体验账号。 */
    @Test
    void defaultProfileCreatesDemoAccount() {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE username = 'test' AND role = 'user' AND status = 'active'",
                Integer.class);
        assertThat(count).isGreaterThanOrEqualTo(1);
    }
}
