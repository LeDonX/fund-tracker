// Backend Cloudflare Pages Function: High-Precision OCR & Structural Data Parsing with Gemini Vision API
// Route: POST /api/ocr

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // 1. 获取 API Key
    // 优先从客户端传入的请求头 x-gemini-api-key 中读取，若没有则使用服务端的 GEMINI_API_KEY
    let apiKey = request.headers.get("x-gemini-api-key");
    if (!apiKey || !apiKey.trim()) {
      apiKey = env.GEMINI_API_KEY;
    }

    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "未配置 Gemini API Key。请在服务器端部署 GEMINI_API_KEY 环境变量，或在上传界面点击右上角设置图标填写您的个人 API Key。" 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          } 
        }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { image, mimeType } = body;

    if (!image || !mimeType) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "无效的请求参数，缺少图片数据或 MimeType" 
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          } 
        }
      );
    }

    // 3. 构建请求 Gemini Vision API 的数据
    // 使用高速、高精度的 gemini-2.5-flash 模型，支持结构化 JSON
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `你是一个高精度的中文支付宝基金交易截图识别助手。请识别并提取出图片中的所有交易记录（可能有多笔，请完整且严格地提取）。
你必须识别并输出以下五个字段：
- name: 基金名称 (例如: "广发利鑫灵活配置混合C"。必须要包含完整的基金名称，不要缩写，去掉前面的'基金-'等修饰性前缀。若名称有换行，请拼接完整。尽量还原图中的基金正式全名)
- code: 基金六位数字编号 (如果图片中能看到或者能确定，请输入。如果不能确定，保留为空字符串 "")
- type: 交易类型 (只能是 "买入" 或 "卖出"。如果是转换转入视作 "买入"，转换转出视作 "卖出"，红利再投视作 "买入"，若是其他类型根据其买入/卖出属性归类)
- amount: 交易金额 (数字，不带货币符号。例如: 100.00。请格外注意识别图片中的小数点，不要漏掉，确保识别的准确度)
- tradeDate: 交易时间 (格式必须为 "YYYY-MM-DD HH:mm:ss"。例如: "2023-10-24 15:00:00"。如果图片中只有日期没有时间，请补齐时间为 "15:00:00"，例如 "2023-10-24 15:00:00"。如果连日期都没有，使用今天的日期并以 10:00:00 填充)

请直接返回一个标准的 JSON 数组，包含所有识别到的交易记录对象，不要有任何 Markdown 标记或其它文字说明。确保输出能被 JSON.parse 成功解析。例如：
[{"name": "广发利鑫灵活配置混合C", "code": "002446", "type": "买入", "amount": "100.00", "tradeDate": "2023-10-24 15:00:00"}]`;

    const geminiRequestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: image // Base64 编码的图片数据
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    // 4. 发起请求到 Gemini API
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr = {};
      try { parsedErr = JSON.parse(errText); } catch(e) {}
      const errMsg = parsedErr.error?.message || errText || "请求 Gemini API 失败";
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Gemini API 错误: ${errMsg}。 (请检查 API Key 的有效性或网络状况)` 
        }),
        { 
          status: response.status, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          } 
        }
      );
    }

    const resData = await response.json();
    const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Gemini Vision API 未返回可解析的文本内容" 
        }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          } 
        }
      );
    }

    // 5. 解析 JSON 输出
    let transactions = [];
    try {
      transactions = JSON.parse(textOutput.trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini output as JSON:", textOutput, parseError);
      // Fallback parsing (in case of markdown headers)
      const jsonMatch = textOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          transactions = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `解析 AI 返回结果失败，内容格式不正确: ${textOutput}` 
            }),
            { 
              status: 500, 
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              } 
            }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `解析 AI 返回结果失败: ${textOutput}` 
          }),
          { 
            status: 500, 
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            } 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactions 
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `OCR 请求处理失败: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      }
    );
  }
}
