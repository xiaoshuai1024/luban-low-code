# 系统关系

当前 workspace 中有四个系统，互相关联，组成鲁班低代码平台。**整体架构为既定规划，各系统边界固定。**

# 仓库与角色

- **luban-ui**（本仓库）  
  底层组件库：基础组件、设计器、Render 组件。不包含管理后台应用。

- **luban-bff**（独立仓库）  
  Node 接入层服务，集成 luban-backend-go 的原子化接口。

- **luban-backend-go**（独立仓库）  
  为 Luban 管理后台与 Render 提供数据服务的底层接口。

- **luban**（独立仓库）  
  系统管理后台，**单独 repo，不放入 luban-ui**。负责站点配置与接入、页面创建与管理。技术栈：Vue 3、Vite、Pinia、Vue Router、Element Plus。