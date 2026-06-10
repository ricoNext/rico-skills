#!/bin/bash

# YApi Sync Skill 完整测试脚本
# 用法: bash test-yapi-sync.sh [--keep-temp]
# 选项: --keep-temp 保留临时测试项目以便检查

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/skills/yapi-sync"
TEST_PROJECT=$(mktemp -d)
KEEP_TEMP=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep-temp)
            KEEP_TEMP=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

log_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${1}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 断言函数
assert_file_exists() {
    local file="$1"
    local desc="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ -f "$file" ]; then
        log_success "$desc (文件: $file)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$desc (文件不存在: $file)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

assert_file_contains() {
    local file="$1"
    local pattern="$2"
    local desc="$3"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if grep -q "$pattern" "$file"; then
        log_success "$desc"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$desc (未找到模式: $pattern)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

assert_dir_exists() {
    local dir="$1"
    local desc="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ -d "$dir" ]; then
        log_success "$desc (目录: $dir)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$desc (目录不存在: $dir)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 清理函数
cleanup() {
    if [ "$KEEP_TEMP" = false ]; then
        log_info "清理临时文件..."
        rm -rf "$TEST_PROJECT"
    else
        log_warning "临时测试项目已保留: $TEST_PROJECT"
    fi
}

trap cleanup EXIT

# ============================================================================
# 测试开始
# ============================================================================

log_section "YApi Sync Skill 测试"
log_info "测试项目: $TEST_PROJECT"
log_info "Skill 目录: $SKILL_DIR"

# ============================================================================
# 第 1 部分: 环境检查
# ============================================================================

log_section "1️⃣  环境检查"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log_success "Node.js 已安装: $NODE_VERSION"
else
    log_error "Node.js 未安装"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    log_success "npm 已安装: $NPM_VERSION"
else
    log_error "npm 未安装"
    exit 1
fi

if [ -d "$SKILL_DIR/scripts/node_modules" ]; then
    log_success "依赖已安装"
else
    log_warning "依赖未安装，开始安装..."
    npm install --prefix "$SKILL_DIR/scripts" > /dev/null 2>&1
    log_success "依赖安装完成"
fi

# ============================================================================
# 第 2 部分: 项目结构初始化
# ============================================================================

log_section "2️⃣  初始化测试项目"

# 创建目录结构
mkdir -p "$TEST_PROJECT/src/api"
log_success "创建项目目录: $TEST_PROJECT"

# 创建示例 API 文件
cat > "$TEST_PROJECT/src/api/user.ts" << 'EOF'
import request from "@/api";

/**
 * 获取用户列表
 */
export const getUserList = (data: {
  /** 页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}) =>
  request<Response<User[]>>("/user/list", { data });

/**
 * 创建用户
 */
export const createUser = (data: {
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
}) =>
  request<Response<User>>("/user/create", { data });
EOF

assert_file_exists "$TEST_PROJECT/src/api/user.ts" "创建示例 API 文件"

# 创建产品 API 文件
cat > "$TEST_PROJECT/src/api/product.ts" << 'EOF'
import request from "@/api";

/**
 * 获取产品详情
 */
export const getProductDetail = (data: {
  /** 产品 ID */
  id: number;
}) =>
  request<Response<Product>>("/product/detail", { data });
EOF

assert_file_exists "$TEST_PROJECT/src/api/product.ts" "创建示例产品 API 文件"

# ============================================================================
# 第 3 部分: 规范检测
# ============================================================================

log_section "3️⃣  规范检测"

log_info "运行规范检测脚本..."
node "$SKILL_DIR/scripts/detect-codegen-style.mjs" "$TEST_PROJECT" > /tmp/detect-output.log 2>&1

assert_dir_exists "$TEST_PROJECT/.yapi-sync" "检查 .yapi-sync 目录"
assert_file_exists "$TEST_PROJECT/.yapi-sync/api-style.md" "规范文件已生成"

# 验证规范文件内容
assert_file_contains "$TEST_PROJECT/.yapi-sync/api-style.md" "src/api" "规范文件包含 API 存放位置"
assert_file_contains "$TEST_PROJECT/.yapi-sync/api-style.md" "内联类型定义" "规范文件包含类型风格"
assert_file_contains "$TEST_PROJECT/.yapi-sync/api-style.md" "camelCase" "规范文件包含命名规范"
assert_file_contains "$TEST_PROJECT/.yapi-sync/api-style.md" "Response" "规范文件包含响应包装"

log_success "显示规范文件内容（前 20 行）："
head -20 "$TEST_PROJECT/.yapi-sync/api-style.md" | sed 's/^/  /'

# ============================================================================
# 第 4 部分: 配置管理
# ============================================================================

log_section "4️⃣  配置管理"

# 创建配置文件
cat > "$TEST_PROJECT/.yapi-sync/config.json" << 'EOF'
{
  "baseUrl": "https://yapi.example.com",
  "cookie": "_yapi_token=test_token; _yapi_uid=test_uid"
}
EOF

assert_file_exists "$TEST_PROJECT/.yapi-sync/config.json" "配置文件已创建"
assert_file_contains "$TEST_PROJECT/.yapi-sync/config.json" "https://yapi.example.com" "配置文件包含 baseUrl"
assert_file_contains "$TEST_PROJECT/.yapi-sync/config.json" "test_token" "配置文件包含 cookie"

log_success "显示配置文件内容："
cat "$TEST_PROJECT/.yapi-sync/config.json" | sed 's/^/  /'

# ============================================================================
# 第 5 部分: 代码生成
# ============================================================================

log_section "5️⃣  代码生成"

# 创建测试接口数据
cat > /tmp/test-interfaces.json << 'EOF'
{
  "results": [
    {
      "ok": true,
      "data": {
        "title": "获取用户列表",
        "path": "/user/list",
        "method": "GET",
        "req_body_other": "{\"type\":\"object\",\"properties\":{\"page\":{\"type\":\"integer\",\"description\":\"页码\"},\"pageSize\":{\"type\":\"integer\",\"description\":\"每页条数\"}},\"required\":[\"page\",\"pageSize\"]}",
        "res_body": "{\"type\":\"array\"}"
      }
    },
    {
      "ok": true,
      "data": {
        "title": "创建用户",
        "path": "/user/create",
        "method": "POST",
        "req_body_other": "{\"type\":\"object\",\"properties\":{\"username\":{\"type\":\"string\",\"description\":\"用户名\"},\"email\":{\"type\":\"string\",\"description\":\"邮箱\"}},\"required\":[\"username\",\"email\"]}",
        "res_body": "{\"type\":\"object\"}"
      }
    },
    {
      "ok": true,
      "data": {
        "title": "获取产品详情",
        "path": "/product/detail",
        "method": "GET",
        "req_body_other": "{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"integer\",\"description\":\"产品ID\"}},\"required\":[\"id\"]}",
        "res_body": "{\"type\":\"object\"}"
      }
    }
  ]
}
EOF

log_info "运行代码生成脚本..."
OUTPUT_DIR="$TEST_PROJECT/generated-api"
node "$SKILL_DIR/scripts/generate-api.mjs" /tmp/test-interfaces.json "$TEST_PROJECT" "$OUTPUT_DIR" > /tmp/generate-output.log 2>&1

assert_dir_exists "$OUTPUT_DIR" "生成输出目录"
assert_file_exists "$OUTPUT_DIR/user.ts" "生成用户模块"
assert_file_exists "$OUTPUT_DIR/product.ts" "生成产品模块"

# 验证生成的代码内容
assert_file_contains "$OUTPUT_DIR/user.ts" "getUser" "生成文件包含函数名"
assert_file_contains "$OUTPUT_DIR/user.ts" "import request" "生成文件包含导入"
assert_file_contains "$OUTPUT_DIR/user.ts" "request<Response>" "生成文件包含类型"
assert_file_contains "$OUTPUT_DIR/user.ts" "export const" "生成文件包含导出"

log_success "显示生成的用户模块（前 15 行）："
head -15 "$OUTPUT_DIR/user.ts" | sed 's/^/  /'

log_success "显示生成的产品模块："
cat "$OUTPUT_DIR/product.ts" | sed 's/^/  /'

# ============================================================================
# 第 6 部分: 文件结构验证
# ============================================================================

log_section "6️⃣  文件结构验证"

log_info "测试项目最终结构："
find "$TEST_PROJECT" -type f | sort | sed 's/^/  /'

assert_dir_exists "$TEST_PROJECT/.yapi-sync" "验证 .yapi-sync 目录存在"
assert_file_exists "$TEST_PROJECT/.yapi-sync/config.json" "验证 config.json"
assert_file_exists "$TEST_PROJECT/.yapi-sync/api-style.md" "验证 api-style.md"

# ============================================================================
# 测试报告
# ============================================================================

log_section "📊 测试报告"

echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "通过率: $PASS_RATE%"

if [ $FAILED_TESTS -eq 0 ]; then
    log_success "所有测试通过！"
    echo ""
    exit 0
else
    log_error "有 $FAILED_TESTS 个测试失败"
    echo ""
    exit 1
fi
