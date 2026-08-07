#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DATAX_ROOT="${DATAX_HOME:-$PROJECT_ROOT/backend/datax}"
DATAX_COMMIT="80ec23d5c5328eb90ca364d2749e92dfaf44541e"
ORACLE_VERSION="21.21.0.0"
ORACLE_SHA256="feec08f9cdb427a87575a7093c1cae27f1c9c13a6b17900743b801ab8ec3696c"
DM_VERSION="8.1.3.140"
DM_SHA256="9af4ff4d6ed15948507f528a18ab9b7196b3600d9169ad7998c19869031a3c6f"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少命令: $1" >&2
    exit 1
  }
}

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

download_verified() {
  local url="$1"
  local expected_sha="$2"
  local destination="$3"
  curl -L --fail --silent --show-error "$url" -o "$destination"
  local actual_sha
  actual_sha="$(sha256_file "$destination")"
  if [[ "$actual_sha" != "$expected_sha" ]]; then
    echo "下载文件校验失败: $destination" >&2
    echo "expected=$expected_sha" >&2
    echo "actual=$actual_sha" >&2
    exit 1
  fi
}

copy_runtime_libraries() {
  local source_libs="$1"
  local target_libs="$2"
  mkdir -p "$target_libs"
  for jar_file in "$source_libs"/*.jar; do
    [[ -f "$jar_file" ]] || continue
    case "$(basename "$jar_file")" in
      mysql-connector-*.jar|postgresql-*.jar) continue ;;
    esac
    cp -f "$jar_file" "$target_libs/"
  done
}

install_plugin() {
  local source_root="$1"
  local module="$2"
  local target_kind="$3"
  local runtime_source="$4"
  local target="$DATAX_ROOT/plugin/$target_kind/$module"
  mkdir -p "$target/libs"
  cp -f "$source_root/$module/src/main/resources/plugin.json" "$target/plugin.json"
  cp -f "$source_root/$module/src/main/resources/plugin_job_template.json" "$target/plugin_job_template.json"
  cp -f "$source_root/$module/target/$module-0.0.1-SNAPSHOT.jar" "$target/$module-0.0.1-SNAPSHOT.jar"
  copy_runtime_libraries "$DATAX_ROOT/plugin/$runtime_source/libs" "$target/libs"
}

require_command git
require_command curl
require_command docker
require_command node

if [[ -n "${DATAX_SOURCE_DIR:-}" ]]; then
  SOURCE_ROOT="$(cd "$DATAX_SOURCE_DIR" && pwd -P)"
else
  BUILD_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/datax-enterprise-build.XXXXXX")"
  SOURCE_ROOT="$BUILD_ROOT/DataX"
  git clone --filter=blob:none https://github.com/alibaba/DataX.git "$SOURCE_ROOT"
  git -C "$SOURCE_ROOT" checkout --detach "$DATAX_COMMIT"
fi

ACTUAL_COMMIT="$(git -C "$SOURCE_ROOT" rev-parse HEAD)"
if [[ "$ACTUAL_COMMIT" != "$DATAX_COMMIT" ]]; then
  echo "DataX 源码版本不匹配: expected=$DATAX_COMMIT actual=$ACTUAL_COMMIT" >&2
  exit 1
fi

docker run --rm \
  -v "$SOURCE_ROOT:/workspace" \
  -w /workspace \
  maven:3.9-eclipse-temurin-8 \
  mvn -T 1C \
    -pl oraclereader,oraclewriter,rdbmsreader,rdbmswriter \
    -am -DskipTests -Dassembly.skipAssembly=true package

install_plugin "$SOURCE_ROOT" oraclereader reader reader/mysqlreader
install_plugin "$SOURCE_ROOT" oraclewriter writer writer/mysqlwriter
install_plugin "$SOURCE_ROOT" rdbmsreader reader reader/postgresqlreader
install_plugin "$SOURCE_ROOT" rdbmswriter writer writer/postgresqlwriter

DOWNLOAD_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/datax-jdbc-drivers.XXXXXX")"
ORACLE_JAR="$DOWNLOAD_ROOT/ojdbc8-$ORACLE_VERSION.jar"
DM_JAR="$DOWNLOAD_ROOT/DmJdbcDriver18-$DM_VERSION.jar"

download_verified \
  "https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/$ORACLE_VERSION/ojdbc8-$ORACLE_VERSION.jar" \
  "$ORACLE_SHA256" \
  "$ORACLE_JAR"
download_verified \
  "https://repo1.maven.org/maven2/com/dameng/DmJdbcDriver18/$DM_VERSION/DmJdbcDriver18-$DM_VERSION.jar" \
  "$DM_SHA256" \
  "$DM_JAR"

cp -f "$ORACLE_JAR" "$DATAX_ROOT/plugin/reader/oraclereader/libs/"
cp -f "$ORACLE_JAR" "$DATAX_ROOT/plugin/writer/oraclewriter/libs/"
cp -f "$DM_JAR" "$DATAX_ROOT/plugin/reader/rdbmsreader/libs/"
cp -f "$DM_JAR" "$DATAX_ROOT/plugin/writer/rdbmswriter/libs/"

node "$PROJECT_ROOT/scripts/verify-datax-enterprise-plugins.js"

if ! command -v java >/dev/null 2>&1; then
  echo "插件已安装；运行 DataX 前还需安装 JDK 8 或 JDK 11。" >&2
fi
