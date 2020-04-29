const getRawBody = require('raw-body');
const json2md = require("json2md");
const got = require('got');;

const FS_APP_ID = process.env.FS_APP_ID || 'cli_9e23a5c25938100e';
const FS_APP_SECRET = process.env.FS_APP_SECRET || 'WnkFEhAwiUzjBSUN48B1LhGNfYReGcVb';
const FS_APPPROVAL_CODE = process.env.FS_APPPROVAL_CODE || 'FAA55736-8B77-46BA-BDBF-7E3F4E225375';
const YQ_X_AUTH_TOKEN = process.env.YQ_X_AUTH_TOKEN || 'AqsjR5eCzOMq7SwFNRQQU0MBn5ZfxnhsZ8K1Crbk';

let tenant_access_token = null;
const now = Date.now();
const YUQUE_NAMWSPACE = 'repos/xsix6';

// 获取飞书token,时效2小时
// TODO token 持久化和失效机制 reids实现
async function generateToken() {
    // 提前10分钟失效
    if (tenant_access_token && now - Date.now() < 2 * (60 - 10) * 60 * 1000 ) {
        return;
    }
    const { body } = await got.post('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal/', {
        json: {
            app_id: FS_APP_ID,
            app_secret: FS_APP_SECRET
        },
        responseType: 'json'
    });
    if (body &&  body.msg === 'ok') {
        tenant_access_token = body.tenant_access_token;
    } else {
        console.error('[feishu-yuque.generateToken]', body.msg);
    }
}

// 持久化，增量获取实例，避免重复同步到语雀 
async function getInstances({ approval_code, start_time, end_time, offset=0, limit=100}) {
    const { body } = await got.post('https://www.feishu.cn/approval/openapi/v2/instance/list', {
        headers: {
            Authorization: `Bearer ${tenant_access_token}`
        },
        json: {
            approval_code,
            start_time,
            end_time,
            offset,
            limit
        },
        responseType: 'json'
    });
    if (body &&  body.code === 0) {
        return body.data.instance_code_list;
    } else {
        console.log('[feishu-yuque.getInstances]', body.msg);
    }
}

// 获取单个详细审批
async function getInstanceDetail({ instance_code }) {
    const { body } = await got.post('https://www.feishu.cn/approval/openapi/v2/instance/get', {
        headers: {
            Authorization: `Bearer ${tenant_access_token}`
        },
        json: {
            instance_code,
            locale: 'en-US'
        },
        responseType: 'json'
    });
    if (body &&  body.code === 0) {
        return body.data;
    } else {
        console.log('[feishu-yuque.getInstanceDetail]', body.msg);
    }
}

async function publishYuQueDoc({ title, slug, public=0, doc}) {
    const { body } = await got.post(`https://www.yuque.com/api/v2/${YUQUE_NAMWSPACE}/issues/docs/`, {
        headers: {
            'X-Auth-Token': YQ_X_AUTH_TOKEN
        },
        json: {
            title,
            slug,
            public,
            body: doc,
        },
        responseType: 'json'
    });
    console.log(body, 'body')
    if (body &&  body.code === 0) {
        return body.data;
    } else {
        console.log('[feishu-yuque.publishYuQueDoc]', body.msg);
    }
}

module.exports.handler = async function(req, resp, context) {
    console.log('[feishu-yuque.approval] begin to sync approval from feishu to yuque...');
    const params = {
        path: req.path,
        queries: req.queries,
        headers: req.headers,
        method : req.method,
        requestURI : req.url,
        clientIP : req.clientIP,
    }
        
    const body = await getRawBody(req);
    resp.setHeader('content-type', 'application/json');
    for (var key in req.queries) {
        var value = req.queries[key];
        resp.setHeader(key, value);
    }
    params.body = body.toString();
    const _body = JSON.parse(params.body);
    console.log(params, 'params.....')
    
    // Verifiy token and challenge code
    if (params.method.toLowerCase() === 'post'
            && _body.challenge && _body.challenge.trim().length > 0
            && _body.token && _body.token.trim().length > 0
            && _body.type === "url_verification") {
        
        console.log('[feishu-yuque.approval] verifiy token and challenge code');
        return resp.send(JSON.stringify({challenge: _body.challenge}, null, '    '));
    }
    console.log('[feishu-yuque.approval] begin to make approval to doucment...');

    // 获取飞书token
    await generateToken();
    const instanceList = await getInstances({ 
        approval_code: FS_APPPROVAL_CODE,
        start_time: Date.now() - 5 * 60 * 1000,
        end_time: Date.now(),
        offset: 0,
        limit: 100
    });
    // TODO 另起一个 serverless 实例分发 instance
    for (const instanceCode of instanceList) {
        const detail = await getInstanceDetail({ instance_code: instanceCode });
        if (detail.status === 'APPROVED') {
            const formList = JSON.parse(detail.form);
            const formMap = formList.reduce((p,v) => {
                p[v.name] = v.value; 
                return p;
            }, {})
            // 开始同步信息到语雀
            let _markdown = (formList.map(f => f.name)).join(' | ');
            _markdown += '|\n| --- | --- |\n|';
            _markdown += (formList.map(f => f.value)).join(' | ');
            _markdown = `| ${_markdown} |`
            console.log(json2md({ table: { headers: Object.keys(formMap), rows: [formMap] } }))
            await publishYuQueDoc({
                title: `${formList[0].value}-${formList[1].value}`,
                slug: `${detail.serial_number}${detail.user_id}`,
                public: 0,
                doc: json2md({ table: { headers: Object.keys(formMap), rows: [formMap] } })
            })
            console.log('[feishu-yuque.approval] 成功创建文档slug: ', `${detail.serial_number}${detail.user_id}`);
        }
    }
    resp.send(JSON.stringify({msg: 'ok'}, null, 2));
}
