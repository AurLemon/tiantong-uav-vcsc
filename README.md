# tiantong-uav-vcsc
2025 年世界职业院校技能大赛总决赛争夺赛（新一代信息技术赛道）的参赛项目代码存档。

天曈无人机管理系统，基于 Rust + Sea ORM Pro + Ant Design Pro 开发。

后端前端分开运行，后端在项目本级目录下使用 `cargo install` 安装依赖，然后执行 `cargo run start` 启动后端服务。

前端在 `frontend` 目录下，使用 `pnpm install` 安装依赖，然后执行 `pnpm run dev` 启动前端服务。

项目具备直接开启 MQTT 服务和 WebSocket 服务的功能，添加完无人机设备后即可配置两者的端口。另外，项目的无人机实时画面功能需要 EasyNVR 服务转接，后端暂时没有直接接入数据的打算（太麻烦）。
