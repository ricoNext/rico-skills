package com.example.order;

public interface OrderService {
  Page<OrderDto> getPagedList(CreateOrderRequest request);

  Long create(CreateOrderRequest request);
}
