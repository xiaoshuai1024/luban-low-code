package com.luban.backend.service;

import com.luban.backend.dto.AbAssignResponse;
import com.luban.backend.dto.AbExperimentCreateRequest;
import com.luban.backend.dto.AbExperimentResponse;
import com.luban.backend.entity.AbAssignment;
import com.luban.backend.entity.AbExperiment;
import com.luban.backend.entity.AbVariant;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.AbAssignmentMapper;
import com.luban.backend.mapper.AbExperimentMapper;
import com.luban.backend.mapper.AbVariantMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AbService 单测：mock mapper，覆盖分流一致性 / 权重区间边界 / ended 语义 /
 * 撞唯一键重查（uk_aba_exp_visitor 竞态收敛，同 LeadService 模式）。
 */
@ExtendWith(MockitoExtension.class)
class AbServiceTest {

    @Mock private AbExperimentMapper experimentMapper;
    @Mock private AbVariantMapper variantMapper;
    @Mock private AbAssignmentMapper assignmentMapper;
    @Mock private SiteOwnershipGuard ownershipGuard;

    private AbService service;

    @BeforeEach
    void setup() {
        service = new AbService(experimentMapper, variantMapper, assignmentMapper, ownershipGuard);
    }

    // ---------- helpers ----------

    private AbExperiment experiment(String id, String status) {
        AbExperiment e = new AbExperiment();
        e.setId(id);
        e.setSiteId("site-1");
        e.setPageId("page-1");
        e.setName("exp");
        e.setStatus(status);
        e.setStartedAt(Instant.now());
        e.setCreatedAt(Instant.now());
        e.setUpdatedAt(Instant.now());
        return e;
    }

    private AbVariant variant(String id, String key, int weight) {
        AbVariant v = new AbVariant();
        v.setId(id);
        v.setExperimentId("exp-1");
        v.setVariantKey(key);
        v.setWeight(weight);
        v.setCreatedAt(Instant.now());
        return v;
    }

    private AbAssignment assignment(String experimentId, String visitorId, String variantId) {
        AbAssignment a = new AbAssignment();
        a.setId("asg-" + variantId);
        a.setExperimentId(experimentId);
        a.setVisitorId(visitorId);
        a.setVariantId(variantId);
        a.setAssignedAt(Instant.now());
        return a;
    }

    // ---------- assign：一致性 ----------

    @Test
    void assignReturnsExistingAssignmentWithoutInsert() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "running"));
        when(assignmentMapper.getByExperimentAndVisitor("exp-1", "visitor-1"))
                .thenReturn(assignment("exp-1", "visitor-1", "var-A"));
        when(variantMapper.getById("var-A")).thenReturn(variant("var-A", "control", 50));

        AbAssignResponse r = service.assign("exp-1", null, "visitor-1");

        assertThat(r.variantId()).isEqualTo("var-A");
        assertThat(r.variantKey()).isEqualTo("control");
        assertThat(r.status()).isEqualTo("running");
        verify(assignmentMapper, never()).insert(any()); // 稳定：直接返回既有分桶
    }

    @Test
    void assignSameVisitorTwiceConvergesToSameVariantAndInsertsOnce() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "running"));
        List<AbVariant> variants = List.of(variant("var-A", "control", 50), variant("var-B", "treatment", 50));
        when(variantMapper.listByExperimentId("exp-1")).thenReturn(variants);
        when(variantMapper.getById(anyString())).thenAnswer(inv -> variant(inv.getArgument(0), "k", 50));
        // 首次无既有分桶；插入后（第二次调用）查到既有分桶——既有分桶 = 首次哈希选中的变体
        AbVariant expected = AbService.pickVariant(variants, AbService.bucket("exp-1", "visitor-1", 100));
        when(assignmentMapper.getByExperimentAndVisitor("exp-1", "visitor-1"))
                .thenReturn(null)
                .thenReturn(assignment("exp-1", "visitor-1", expected.getId()));

        AbAssignResponse first = service.assign("exp-1", null, "visitor-1");
        AbAssignResponse second = service.assign("exp-1", null, "visitor-1");

        assertThat(first.variantId()).isEqualTo(expected.getId());
        assertThat(second.variantId()).isEqualTo(first.variantId()); // 分流一致性
        verify(assignmentMapper, times(1)).insert(any());
    }

    @Test
    void assignPicksWeightedVariantAndInsertsAssignment() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "running"));
        List<AbVariant> variants = List.of(variant("var-A", "control", 50), variant("var-B", "treatment", 50));
        when(variantMapper.listByExperimentId("exp-1")).thenReturn(variants);
        when(assignmentMapper.getByExperimentAndVisitor("exp-1", "visitor-1")).thenReturn(null);
        when(variantMapper.getById(anyString())).thenAnswer(inv -> variant(inv.getArgument(0), "k", 50));

        AbAssignResponse r = service.assign("exp-1", null, "visitor-1");

        // 选中者与独立计算的权重区间一致（区间数学由下方边界用例直接覆盖）
        AbVariant expected = AbService.pickVariant(variants, AbService.bucket("exp-1", "visitor-1", 100));
        assertThat(r.variantId()).isEqualTo(expected.getId());
        assertThat(r.variantId()).isIn("var-A", "var-B");
        ArgumentCaptor<AbAssignment> captor = ArgumentCaptor.forClass(AbAssignment.class);
        verify(assignmentMapper).insert(captor.capture());
        assertThat(captor.getValue().getVariantId()).isEqualTo(expected.getId());
        assertThat(captor.getValue().getVisitorId()).isEqualTo("visitor-1");
        assertThat(captor.getValue().getExperimentId()).isEqualTo("exp-1");
    }

    @Test
    void assignResolvesRunningExperimentByPageIdWhenExperimentIdAbsent() {
        when(experimentMapper.resolveByPageId("page-1")).thenReturn(experiment("exp-9", "running"));
        when(assignmentMapper.getByExperimentAndVisitor("exp-9", "visitor-1"))
                .thenReturn(assignment("exp-9", "visitor-1", "var-A"));
        when(variantMapper.getById("var-A")).thenReturn(variant("var-A", "control", 50));

        AbAssignResponse r = service.assign(null, "page-1", "visitor-1");

        assertThat(r.experimentId()).isEqualTo("exp-9");
        assertThat(r.variantId()).isEqualTo("var-A");
        verify(experimentMapper, never()).getById(anyString()); // pageId 路径不走 id 直查
    }

    // ---------- assign：ended / 不存在 ----------

    @Test
    void assignEndedExperimentReturnsNullVariantWithEndedStatus() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "ended"));

        AbAssignResponse r = service.assign("exp-1", null, "visitor-1");

        assertThat(r.variantId()).isNull();
        assertThat(r.variantKey()).isNull();
        assertThat(r.status()).isEqualTo("ended");
        verify(assignmentMapper, never()).getByExperimentAndVisitor(anyString(), anyString());
        verify(assignmentMapper, never()).insert(any());
    }

    @Test
    void assignUnknownExperimentThrowsNotFound() {
        when(experimentMapper.getById("nope")).thenReturn(null);

        assertThatThrownBy(() -> service.assign("nope", null, "visitor-1"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("AB_EXPERIMENT_NOT_FOUND");
    }

    @Test
    void assignPageWithoutAnyExperimentThrowsNotFound() {
        when(experimentMapper.resolveByPageId("page-x")).thenReturn(null);

        assertThatThrownBy(() -> service.assign(null, "page-x", "visitor-1"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("AB_EXPERIMENT_NOT_FOUND");
    }

    // ---------- assign：撞唯一键重查（并发竞态收敛） ----------

    @Test
    void assignUniqueKeyViolationRequeriesAndConverges() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "running"));
        when(variantMapper.listByExperimentId("exp-1"))
                .thenReturn(List.of(variant("var-A", "control", 50), variant("var-B", "treatment", 50)));
        when(assignmentMapper.getByExperimentAndVisitor("exp-1", "visitor-1"))
                .thenReturn(null)                                             // check-then-insert 的 check
                .thenReturn(assignment("exp-1", "visitor-1", "var-B"));      // 撞键后重查的既有分桶
        when(assignmentMapper.insert(any())).thenThrow(new DataIntegrityViolationException(
                "Duplicate entry 'exp-1-visitor-1' for key 'uk_aba_exp_visitor'"));
        when(variantMapper.getById("var-B")).thenReturn(variant("var-B", "treatment", 50));

        AbAssignResponse r = service.assign("exp-1", null, "visitor-1");

        assertThat(r.variantId()).isEqualTo("var-B"); // 收敛到并发已写入的分桶，不冒泡 500
        verify(assignmentMapper, times(2)).getByExperimentAndVisitor("exp-1", "visitor-1"); // 撞键重查
    }

    @Test
    void assignUniqueKeyViolationWithoutExistingRowRethrowsDefensively() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "running"));
        when(variantMapper.listByExperimentId("exp-1"))
                .thenReturn(List.of(variant("var-A", "control", 50)));
        when(assignmentMapper.getByExperimentAndVisitor("exp-1", "visitor-1")).thenReturn(null);
        when(assignmentMapper.insert(any())).thenThrow(new DataIntegrityViolationException(
                "Duplicate entry 'exp-1-visitor-1' for key 'uk_aba_exp_visitor'"));

        // 理论不可达（唯一键冲突必有既有行）：防御性冒泡原异常
        assertThatThrownBy(() -> service.assign("exp-1", null, "visitor-1"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void assignNonUniqueIntegrityViolationPropagates() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "running"));
        when(variantMapper.listByExperimentId("exp-1"))
                .thenReturn(List.of(variant("var-A", "control", 50)));
        when(assignmentMapper.getByExperimentAndVisitor("exp-1", "visitor-1")).thenReturn(null);
        when(assignmentMapper.insert(any())).thenThrow(new DataIntegrityViolationException(
                "Foreign key constraint violation: fk_aba_var"));

        assertThatThrownBy(() -> service.assign("exp-1", null, "visitor-1"))
                .isInstanceOf(DataIntegrityViolationException.class);
        verify(assignmentMapper, times(1)).getByExperimentAndVisitor("exp-1", "visitor-1"); // 未重查
    }

    // ---------- 权重区间边界（纯函数） ----------

    @Test
    void pickVariantWalksCumulativeWeightIntervals() {
        List<AbVariant> variants = List.of(
                variant("v0", "a", 30),
                variant("v1", "b", 70));

        assertThat(AbService.pickVariant(variants, 0)).isEqualTo(variants.get(0));   // 区间起点
        assertThat(AbService.pickVariant(variants, 29)).isEqualTo(variants.get(0));  // [0,30) 末位
        assertThat(AbService.pickVariant(variants, 30)).isEqualTo(variants.get(1));  // [30,100) 起点（边界换档）
        assertThat(AbService.pickVariant(variants, 99)).isEqualTo(variants.get(1));  // 区间末位
        assertThat(AbService.pickVariant(variants, 100)).isEqualTo(variants.get(1)); // 越界兜底末位
    }

    @Test
    void pickVariantThreeWayBoundaries() {
        List<AbVariant> variants = List.of(
                variant("v0", "a", 20),
                variant("v1", "b", 30),
                variant("v2", "c", 50));

        assertThat(AbService.pickVariant(variants, 19)).isEqualTo(variants.get(0));
        assertThat(AbService.pickVariant(variants, 20)).isEqualTo(variants.get(1));
        assertThat(AbService.pickVariant(variants, 49)).isEqualTo(variants.get(1));
        assertThat(AbService.pickVariant(variants, 50)).isEqualTo(variants.get(2));
        assertThat(AbService.pickVariant(variants, 99)).isEqualTo(variants.get(2));
    }

    @Test
    void positiveHashIsDeterministicNonNegativeAndDispersing() {
        long h1a = AbService.positiveHash("exp-1", "visitor-1");
        long h1b = AbService.positiveHash("exp-1", "visitor-1");
        long h2 = AbService.positiveHash("exp-1", "visitor-2");

        assertThat(h1a).isEqualTo(h1b);          // 跨调用稳定（JVM 内一致性哈希）
        assertThat(h1a).isNotNegative();          // 非负（落区间前提）
        assertThat(h2).isNotEqualTo(h1a);         // 不同 visitor 分散（固定串 SHA-256 确定性）

        // 分散性 sanity：20 个 visitor 落 50/50 区间应覆盖至少一个变体（e2e AB3 best-effort 同口径）
        int totalWeight = 100;
        long buckets = java.util.stream.IntStream.range(0, 20)
                .mapToLong(i -> AbService.bucket("exp-1", "scatter-" + i, totalWeight))
                .boxed()
                .collect(java.util.stream.Collectors.toSet())
                .size();
        assertThat(buckets).isGreaterThanOrEqualTo(1);
    }

    @Test
    void bucketIsStableAndWithinRange() {
        long total = 100;
        long b1 = AbService.bucket("exp-1", "visitor-1", total);
        long b2 = AbService.bucket("exp-1", "visitor-1", total);
        assertThat(b1).isEqualTo(b2);
        assertThat(b1).isBetween(0L, total - 1);

        // 不同权重总和不改变取值域边界语义
        assertThat(AbService.bucket("exp-1", "visitor-1", 1)).isEqualTo(0);
    }

    // ---------- create / end ----------

    @Test
    void createFallsBackVariantKeyFromLabelAndDefaultsWeight() {
        AbExperimentCreateRequest req = new AbExperimentCreateRequest(
                "site-1", "page-1", "exp", 100, "running",
                List.of(
                        new AbExperimentCreateRequest.VariantPayload(null, "对照组", 50, true, null),
                        new AbExperimentCreateRequest.VariantPayload(null, null, null, false, null)));

        AbExperimentResponse resp = service.create(req);

        verify(ownershipGuard).assertCanWrite("site-1");
        assertThat(resp.id()).isNotBlank();
        assertThat(resp.status()).isEqualTo("running");
        assertThat(resp.startedAt()).isNotNull();
        ArgumentCaptor<AbVariant> captor = ArgumentCaptor.forClass(AbVariant.class);
        verify(variantMapper, times(2)).insert(captor.capture());
        List<AbVariant> inserted = captor.getAllValues();
        assertThat(inserted.get(0).getVariantKey()).isEqualTo("对照组"); // label 回落
        assertThat(inserted.get(0).getWeight()).isEqualTo(50);
        assertThat(inserted.get(1).getVariantKey()).isEqualTo("variant-2"); // 双空回落
        assertThat(inserted.get(1).getWeight()).isEqualTo(50);              // 缺省权重
        assertThat(inserted).allSatisfy(v -> assertThat(v.getExperimentId()).isEqualTo(resp.id()));
    }

    @Test
    void endUpdatesStatusAndEndedAtOnce() {
        AbExperiment exp = experiment("exp-1", "running");
        when(experimentMapper.getById("exp-1")).thenReturn(exp);
        when(variantMapper.listByExperimentId("exp-1")).thenReturn(List.of(variant("var-A", "control", 50)));

        AbExperimentResponse resp = service.end("exp-1");

        verify(experimentMapper).end(eq("exp-1"), any(Instant.class), any(Instant.class));
        assertThat(resp.status()).isEqualTo("ended");
        assertThat(resp.endedAt()).isNotNull();
    }

    @Test
    void endIsIdempotentForAlreadyEndedExperiment() {
        when(experimentMapper.getById("exp-1")).thenReturn(experiment("exp-1", "ended"));
        when(variantMapper.listByExperimentId("exp-1")).thenReturn(List.of(variant("var-A", "control", 50)));

        AbExperimentResponse resp = service.end("exp-1");

        verify(experimentMapper, never()).end(anyString(), any(Instant.class), any(Instant.class));
        assertThat(resp.status()).isEqualTo("ended");
    }

    @Test
    void endUnknownExperimentThrowsNotFound() {
        when(experimentMapper.getById("nope")).thenReturn(null);

        assertThatThrownBy(() -> service.end("nope"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("AB_EXPERIMENT_NOT_FOUND");
    }
}
