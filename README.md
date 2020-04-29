## 功能

- 飞书审批同步至语雀

## 快速开始

### 飞书环境配置

- [审批事件监听开发指南](https://open.feishu.cn/document/ugTM5UjL4ETO14COxkTN/ugDNyUjL4QjM14CO0ITN)

### 依赖安装

```bash
$ cd feishu-yuque/approval
$ npm install
```

### 环境变量

- FS_APP_ID: 飞书自定义审批 app_id
- FS_APP_SECRET: 飞书自定义审批 app_secret
- FS_APPPROVAL_CODE: 飞书自定义审批唯一码
- YQ_X_AUTH_TOKEN: [语雀开发者 token](https://www.yuque.com/yuque/developer/api)
- YUQUE_NAMWSPACE: [语雀知识库](https://www.yuque.com/yuque/developer/api)

### 开发部署

[Via Aliyun Serverless VSCode Extension](https://github.com/alibaba/serverless-vscode)