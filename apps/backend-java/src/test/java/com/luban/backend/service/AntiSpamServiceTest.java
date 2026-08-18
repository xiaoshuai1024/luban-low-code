package com.luban.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * AntiSpamService 单测：用 Mockito mock StringRedisTemplate，覆盖 Lua 原子频控分支。
 * 不依赖 Redis 实际运行；脚本内容（INCR + EXPIRE NX 单脚本）与调用参数通过 captor 检验。
 */
@ExtendWith(MockitoExtension.class)
class AntiSpamServiceTest {

    private static final String KEY = "antispam:form:f1:ip:1.2.3.4";

    @Mock
    private StringRedisTemplate redis;

    private AntiSpamService service() {
        return new AntiSpamService(redis);
    }

    @SuppressWarnings("unchecked")
    private RedisScript<Long> capturedScript() {
        ArgumentCaptor<RedisScript<Long>> captor = ArgumentCaptor.forClass(RedisScript.class);
        verify(redis).execute(captor.capture(), eq(List.of(KEY)), eq("60"));
        return captor.getValue();
    }

    // === 原子化（close-tech-debt-1 3.2）：单条 Lua 完成计数 + TTL，不再两步 increment/expire ===

    @Test
    void singleLuaCallIncrementsAndSetsWindowTtlAtomically() {
        doReturn(1L).when(redis).execute(any(), anyList(), any());

        assertThat(service().isRateLimited("1.2.3.4", "f1", 5, 60)).isFalse();

        // 仅一次 Redis 调用（脚本原子），key 与窗口参数正确
        RedisScript<Long> script = capturedScript();
        // 脚本内容：INCR 计数 + EXPIRE NX 设 TTL（NX 保证无 TTL 键也补上，进程中断不留永久键）
        String lua = script.getScriptAsString();
        assertThat(lua).contains("INCR");
        assertThat(lua).contains("EXPIRE");
        assertThat(lua).contains("'NX'");
        assertThat(lua).doesNotContain("PEXPIRE"); // 秒级窗口，参数为秒
        // 旧的两步写法（increment + expire 分离）已移除
        verify(redis, never()).opsForValue();
        verify(redis, never()).expire(anyString(), any());
    }

    @Test
    void customWindowSecondsPassedToScript() {
        doReturn(3L).when(redis).execute(any(), anyList(), any());

        assertThat(service().isRateLimited("1.2.3.4", "f1", 2, 30)).isTrue();

        verify(redis).execute(any(), eq(List.of(KEY)), eq("30"));
    }

    // === 阈值边界（spec：max=2 窗口 30s，第 3 次被限流） ===

    @Test
    void thirdHitWithMaxTwoInWindowThirtyIsLimited() {
        doReturn(3L).when(redis).execute(any(), anyList(), any()); // 窗口内第 3 次提交

        assertThat(service().isRateLimited("1.2.3.4", "f1", 2, 30)).isTrue();
    }

    @Test
    void countAtExactMaxNotLimited() {
        doReturn(5L).when(redis).execute(any(), anyList(), any()); // 恰好等于上限

        assertThat(service().isRateLimited("1.2.3.4", "f1", 5, 60)).isFalse();
    }

    @Test
    void countOverMaxLimited() {
        doReturn(6L).when(redis).execute(any(), anyList(), any());

        assertThat(service().isRateLimited("1.2.3.4", "f1", 5, 60)).isTrue();
    }

    @Test
    void redisReturningNullFailsOpen() {
        doReturn(null).when(redis).execute(any(), anyList(), any());

        assertThat(service().isRateLimited("1.2.3.4", "f1", 5, 60)).isFalse();
    }

    // === 非法输入跳过频控 ===

    @Test
    void nullIpSkipsRedis() {
        assertThat(service().isRateLimited(null, "f1", 5, 60)).isFalse();
        verifyNoInteractions(redis);
    }

    @Test
    void blankIpSkipsRedis() {
        assertThat(service().isRateLimited("  ", "f1", 5, 60)).isFalse();
        verifyNoInteractions(redis);
    }

    @Test
    void nonPositiveMaxSkipsRedis() {
        assertThat(service().isRateLimited("1.2.3.4", "f1", 0, 60)).isFalse();
        verifyNoInteractions(redis);
    }

    @Test
    void nonPositiveWindowSkipsRedis() {
        // 非法窗口不发出会删除键/报错的 EXPIRE 0
        assertThat(service().isRateLimited("1.2.3.4", "f1", 5, 0)).isFalse();
        verifyNoInteractions(redis);
    }
}
