package com.example.order;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class OrderDto extends AuditedDto {
  private String id;
  private List<OrderItemDto> items;
  private Map<String, BigDecimal> amounts;
  private Optional<OrderStatus> status;
}
