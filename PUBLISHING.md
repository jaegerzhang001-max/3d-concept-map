# 发布清单

## 一、本地仓库

```bash
git init
git add .
git commit -m "feat: 3D concept map plugin v0.2.0"
git branch -M main
git remote add origin https://github.com/<你的账号>/3d-concept-map.git
git push -u origin main
```

## 二、GitHub Release（BRAT 依赖这一步）

1. 打 tag：`git tag 0.2.0 && git push origin 0.2.0`
2. 在 GitHub → Releases → Draft a new release
3. Tag 选 `0.2.0`，标题写 `0.2.0`
4. **手动上传三个文件**：
   - `main.js`
   - `manifest.json`
   - `styles.css`
5. 发布

> 注意：`manifest.json` 里的 `version` 必须与 tag 完全一致（当前 `0.2.0`）。

## 三、BRAT 分发（免审核）

用户：
1. 安装 BRAT
2. 命令面板 → `BRAT: Add a beta plugin`
3. 填仓库 `账号/3d-concept-map`

## 四、官方社区市场

1. Fork `obsidianmd/obsidian-releases`
2. 在 `community-plugins.json` 末尾加入：

```json
{
  "id": "concept-map-3d",
  "name": "3D Concept Map",
  "author": "Jäger Zhang",
  "description": "Turn your vault into an interactive 3D concept network.",
  "repo": "账号/3d-concept-map"
}
```

3. 提 PR，等待审核（1–2 周）

### 审核要点（自查）

- [x] 无外部进程调用（Python / PowerShell 已移除）
- [x] 无硬编码绝对路径
- [x] manifest 字段齐全
- [x] README 有安装与用法
- [x] 不修改用户数据（只写自己配置的目录）
- [x] 设置面板存在

## 五、版本升级流程

1. 改代码 → 同步改 `manifest.json` 的 `version`
2. `versions.json` 加一行 `"新版本": "minAppVersion"`
3. commit + tag + release（重新上传三件套）

## 六、回滚

- 插件目录：`.obsidian/plugins/concept-map-3d/`
- 旧版本：从 GitHub Releases 下载对应 tag 的三件套覆盖
