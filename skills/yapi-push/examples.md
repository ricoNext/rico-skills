# 示例

## 同步单个接口

```bash
node scripts/push-interface.mjs --project /path/to/repo \
  --dry-run --route /v1/mis-quotation-space/getQuotationSpaceList
```

带域名的地址同样可以：

```bash
node scripts/push-interface.mjs --project /path/to/repo \
  --dry-run --route 'https://mis.example.com/v1/mis-quotation-space/getQuotationSpaceList'
```

确认后写入：

```bash
node scripts/push-interface.mjs --project /path/to/repo \
  --project-id 112 --cat-id 1686 \
  --strategy overwrite \
  --route /v1/mis-quotation-space/getQuotationSpaceList
```

## 同步一个 Controller 下全部接口

```bash
node scripts/push-interface.mjs --project /path/to/repo \
  --project-id 112 --cat-id 1686 \
  --dry-run --route /v1/mis-quotation-space
```

## 列出分类

```bash
node scripts/push-interface.mjs --project /path/to/repo \
  --list-cats --project-id 112
```

## dry-run 里能看到的信息

```json
{
  "ok": true,
  "items": [
    {
      "title": "查询用户的快速报价空间 - C",
      "path": "/v1/mis-quotation-space/getQuotationSpaceList",
      "method": "POST",
      "action": "create",
      "controller": "MisQuotationSpaceController",
      "javaMethod": "getQuotationSpaceList",
      "source": "com/goneo/cloud/mis/admin/quotation/controller/MisQuotationSpaceController.java"
    }
  ]
}
```
