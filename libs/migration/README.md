# 运行迁移器 CLI

- 生成新的迁移文件
  ```sh
  cargo run -- migrate generate MIGRATION_NAME
  ```
- 应用所有待处理的迁移
  ```sh
  cargo run
  ```
  ```sh
  cargo run -- up
  ```
- 应用前 10 个待处理的迁移
  ```sh
  cargo run -- up -n 10
  ```
- 回滚最后应用的迁移
  ```sh
  cargo run -- down
  ```
- 回滚最后 10 个应用的迁移
  ```sh
  cargo run -- down -n 10
  ```
- 删除数据库中的所有表，然后重新应用所有迁移
  ```sh
  cargo run -- fresh
  ```
- 回滚所有已应用的迁移，然后重新应用所有迁移
  ```sh
  cargo run -- refresh
  ```
- 回滚所有已应用的迁移
  ```sh
  cargo run -- reset
  ```
- 检查所有迁移的状态
  ```sh
  cargo run -- status
  ```
