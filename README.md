# PRAXDOC Health Visible Workspace

这个仓库保存 `health-visible` 当前阶段的代码工程、产品规范、数据库脚本和联调材料。

## 目录导航

- `health-visible-kb-api-skeleton-v1.1/`
  - 当前可运行的后端 API 骨架工程
  - 包含 `src/`、`scripts/`、`public/`、工程内 `docs/` 和自动生成的 `reports/`
- `docs/product/`
  - 上层产品背景材料
- `docs/specs/`
  - 字段规范、范围边界、知识库规范等长期参考文档
- `docs/plans/`
  - 任务单、计划表、验收表、落地清单等执行类文档
- `docs/reports/`
  - 手工整理的联调/预检说明文档
- `sql/`
  - 数据库迁移、种子数据、查询模板
- `api/`
  - OpenAPI 定义
- `postman/`
  - Postman 集合和环境
- `assets/screenshots/`
  - 截图和界面素材

## 常用开发入口

进入代码工程：

```powershell
cd .\health-visible-kb-api-skeleton-v1.1
```

常用命令：

```powershell
npm install
npm run check
npm run build
npm run smoke:all
npm run preflight:report
```

## 维护约定

- 代码改动尽量收敛在 `health-visible-kb-api-skeleton-v1.1/`
- 产品和规范文档优先放到 `docs/` 对应分区
- SQL、OpenAPI、Postman 文件不要继续散放到根目录
- 自动生成的服务日志不入库，预检报告继续保留在代码工程自己的 `reports/`

## Git 工作流

提交当前进度：

```powershell
git add .
git commit -m "描述这次改动"
git push
```
