use super::m20250807_000001_create_roles_table::Role;
use super::m20250807_000002_create_permissions_table::Permission;
use super::m20250807_000003_create_user_roles_table::UserRole;
use super::m20250807_000004_create_role_permissions_table::RolePermission;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 创建默认角色
        let insert_roles = Query::insert()
            .into_table(Role::Table)
            .columns([Role::Name, Role::Description, Role::IsActive])
            .values_panic([
                "admin".into(),
                "管理员角色，拥有所有权限".into(),
                true.into(),
            ])
            .values_panic([
                "user".into(),
                "普通用户角色，拥有基本权限".into(),
                true.into(),
            ])
            .to_owned();
        manager.exec_stmt(insert_roles).await?;

        // 创建默认权限
        let permissions = vec![
            // 用户管理权限
            ("users.read", "查看用户", "users", "read"),
            ("users.write", "创建/编辑用户", "users", "write"),
            ("users.delete", "删除用户", "users", "delete"),
            // 设备管理权限
            ("devices.read", "查看设备", "devices", "read"),
            ("devices.write", "创建/编辑设备", "devices", "write"),
            ("devices.delete", "删除设备", "devices", "delete"),
            ("devices.control", "控制设备", "devices", "control"),
            // 任务管理权限
            ("tasks.read", "查看任务", "tasks", "read"),
            ("tasks.write", "创建/编辑任务", "tasks", "write"),
            ("tasks.delete", "删除任务", "tasks", "delete"),
            ("tasks.execute", "执行任务", "tasks", "execute"),
            // 角色权限管理
            ("roles.read", "查看角色", "roles", "read"),
            ("roles.write", "创建/编辑角色", "roles", "write"),
            ("roles.delete", "删除角色", "roles", "delete"),
            // 权限管理
            ("permissions.read", "查看权限", "permissions", "read"),
            ("permissions.assign", "分配权限", "permissions", "assign"),
            // 系统管理
            ("system.admin", "系统管理", "system", "admin"),
        ];

        for (name, description, resource, action) in permissions {
            let insert_permission = Query::insert()
                .into_table(Permission::Table)
                .columns([
                    Permission::Name,
                    Permission::Description,
                    Permission::Resource,
                    Permission::Action,
                ])
                .values_panic([
                    name.into(),
                    description.into(),
                    resource.into(),
                    action.into(),
                ])
                .to_owned();
            manager.exec_stmt(insert_permission).await?;
        }

        // 为admin角色分配所有权限
        // 注意：这里我们使用简化的方式，直接插入角色权限关联
        // 在实际应用中，你可能需要先查询ID然后插入

        // 为admin角色分配所有权限（权限ID 1-17）
        for permission_id in 1..=17 {
            let insert_role_permission = Query::insert()
                .into_table(RolePermission::Table)
                .columns([RolePermission::RoleId, RolePermission::PermissionId])
                .values_panic([1.into(), permission_id.into()]) // admin角色ID为1
                .to_owned();
            manager.exec_stmt(insert_role_permission).await?;
        }

        // 为user角色分配基本权限（只读权限）
        let user_permissions = vec![1, 4, 7, 13]; // users.read, devices.read, tasks.read, roles.read
        for permission_id in user_permissions {
            let insert_role_permission = Query::insert()
                .into_table(RolePermission::Table)
                .columns([RolePermission::RoleId, RolePermission::PermissionId])
                .values_panic([2.into(), permission_id.into()]) // user角色ID为2
                .to_owned();
            manager.exec_stmt(insert_role_permission).await?;
        }

        // 为tiantong用户分配admin角色
        let insert_user_role = Query::insert()
            .into_table(UserRole::Table)
            .columns([UserRole::UserId, UserRole::RoleId])
            .values_panic([1.into(), 1.into()]) // 假设tiantong用户ID为1，admin角色ID为1
            .to_owned();
        manager.exec_stmt(insert_user_role).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 清理数据
        manager
            .exec_stmt(Query::delete().from_table(RolePermission::Table).to_owned())
            .await?;
        manager
            .exec_stmt(Query::delete().from_table(UserRole::Table).to_owned())
            .await?;
        manager
            .exec_stmt(Query::delete().from_table(Permission::Table).to_owned())
            .await?;
        manager
            .exec_stmt(Query::delete().from_table(Role::Table).to_owned())
            .await?;
        Ok(())
    }
}
