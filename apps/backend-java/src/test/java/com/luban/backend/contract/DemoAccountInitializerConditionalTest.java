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
 *  - app.demo-account.enabled=true → bean 加载（dev compose 显式开启，matchIfMissing=false）；
 *  - =false / 未配置 → bean 不加载（默认关闭：安全缺省，生产/未知环境无内置体验账号）；
 *  - 默认 test profile 下 ApplicationRunner 不执行：users 表无 test 账号。
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
    void missingPropertyDefaultsToDisabled() {
        runner.run(ctx -> assertThat(ctx).doesNotHaveBean(DemoAccountInitializer.class));
    }

    /** 行为锁：默认（test profile 走 application.yml 缺省 false）时启动不创建 test 体验账号。 */
    @Test
    void defaultProfileDoesNotCreateDemoAccount() {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE username = 'test' AND role = 'user' AND status = 'active'",
                Integer.class);
        assertThat(count).isZero();
    }
}
