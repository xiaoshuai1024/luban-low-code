package com.luban.backend.mapper;

import com.luban.backend.entity.Order;
import org.apache.ibatis.annotations.*;

import java.time.Instant;
import java.util.List;

@Mapper
public interface OrderMapper {

    String COLS = "id, order_no, user_id, plan_code, amount, status, paid_at, created_at, updated_at";

    /** 重复下单幂等返回的「原单」：同用户同套餐最近一笔已支付订单。 */
    @Select("SELECT " + COLS + " FROM orders WHERE user_id = #{userId} AND plan_code = #{planCode} AND status = 'paid' " +
            "ORDER BY created_at DESC LIMIT 1")
    Order findLatestPaidByUserAndPlan(@Param("userId") String userId, @Param("planCode") String planCode);

    @Select("SELECT " + COLS + " FROM orders WHERE user_id = #{userId} ORDER BY created_at DESC LIMIT #{size} OFFSET #{offset}")
    List<Order> listByUserId(@Param("userId") String userId, @Param("offset") int offset, @Param("size") int size);

    @Select("SELECT COUNT(1) FROM orders WHERE user_id = #{userId}")
    long countByUserId(String userId);

    @Insert("INSERT INTO orders (id, order_no, user_id, plan_code, amount, status, paid_at, created_at, updated_at) " +
            "VALUES (#{id}, #{orderNo}, #{userId}, #{planCode}, #{amount}, #{status}, #{paidAt}, #{createdAt}, #{updatedAt})")
    int insert(Order order);

    /** 0 元自动支付：pending → paid（限定 pending 起始态，幂等）。 */
    @Update("UPDATE orders SET status = 'paid', paid_at = #{paidAt}, updated_at = #{updatedAt} " +
            "WHERE id = #{id} AND status = 'pending'")
    int markPaid(@Param("id") String id, @Param("paidAt") Instant paidAt, @Param("updatedAt") Instant updatedAt);

    /** 并发竞态让位删除（OrderService 防御纵深路径；限定属主防误删）。 */
    @Delete("DELETE FROM orders WHERE id = #{id} AND user_id = #{userId}")
    int deleteByIdAndUser(@Param("id") String id, @Param("userId") String userId);
}
