package com.example.order;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/orders")
public class OrderController {
  private OrderService orderService;

  @GetMapping("/{id}")
  public ResponseEntity<OrderDto> getOrder(
      @PathVariable("id") String id,
      @RequestParam(name = "includeItems", required = false) boolean includeItems,
      @RequestHeader("X-Tenant") String tenant) {
    return null;
  }

  @PostMapping
  public ResponseEntity<OrderDto> createOrder(@RequestBody CreateOrderRequest request) {
    return null;
  }

  @PostMapping("/page")
  public GoneoResult<?> getPagedList(@RequestBody CreateOrderRequest request) {
    return GoneoResult.ok(orderService.getPagedList(request));
  }

  @PostMapping("/quick")
  public GoneoResult<?> createQuick(@RequestBody CreateOrderRequest request) {
    Long id = orderService.create(request);
    return GoneoResult.ok(Map.of("id", id));
  }
}
