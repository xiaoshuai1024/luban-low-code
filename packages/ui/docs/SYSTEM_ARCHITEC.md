# 系统关系

当前 workspace 中有六个系统，互相关联，组成鲁班低代码平台。**整体架构为既定规划，各系统边界固定。**

# 仓库与角色

- **luban-ui**（本仓库）  
  底层组件库：基础组件、设计器、Render 组件。不包含管理后台应用。

- **luban-bff**（独立仓库）  
  Node 接入层服务，通过 `BACKEND_BASE_URL` 调用后端原子化接口（默认对接 luban-backend）。

- **luban-backend**（独立仓库，**主后端**）  
  Java 实现（Spring Boot + MyBatis + Redis + MySQL），为 Luban 管理后台与 Render 提供数据服务。**平台 API 的权威文档在本仓库维护**（见 `luban-backend/docs/API.md`），BFF 与前端以该文档为对接规范。

- **luban-backend-go**（独立仓库）  
  与 luban-backend 同契约的 Go 实现，接口行为与 `luban-backend/docs/API.md` 保持一致，可作为参考或备用运行时。

- **luban**（独立仓库）  
  系统管理后台，**单独 repo，不放入 luban-ui**。负责站点配置与接入、页面创建与管理。技术栈：Vue 3、Vite、Pinia、Vue Router、Element Plus。


- luban-website
vue3 SSR网站，通过请求bff获取数据并渲染render来展示页面