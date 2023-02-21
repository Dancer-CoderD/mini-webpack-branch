import fs from "fs";
import ejs from "ejs";
import path from "path";
import parser from "@babel/parser";
import traverse from "@babel/traverse";
import { transformFromAst } from "babel-core";
import { jsonLoader } from "./jsonLoader.js";

let id = 0;

const webpackConfig = {
  module: {
    rules: [
      {
        test: /\.json$/,
        use: [jsonLoader],
      },
    ],
  },
};

// 处理静态资源
function createAsset(filePath) {
  // 1. 获取文件的内容

  let source = fs.readFileSync(filePath, {
    encoding: "utf-8", // 将buffer转为utf8
  });

  // initLoader机制
  const loaders = webpackConfig.module.rules;
  // webpack执行loader时传入上下文
  const loaderContext = {
    addDeps(dep) {
      console.log("addDeps", dep);
    },
  };

  loaders.forEach(({ test, use }) => {
    if (test.test(filePath)) {
      if (Array.isArray(use)) {
        use.reverse().forEach((fn) => {
          source = fn.call(loaderContext, source);
        });
      }
    }
  });

  // 2. 获取依赖关系
  // ast -> 抽象语法树

  const ast = parser.parse(source, {
    sourceType: "module", // 以模块方式导入解析
  });

  const deps = [];
  // 遍历ast
  traverse.default(ast, {
    ImportDeclaration({ node }) {
      deps.push(node.source.value);
    },
  });

  // 利用babel获取处理完成的ast
  const { code } = transformFromAst(ast, null, {
    presets: ["env"],
  });
  console.log(code);

  return {
    filePath,
    code,
    deps,
    mapping: {},
    id: id++,
  };
}

// 构建依赖图
function createGraph() {
  const mainAsset = createAsset("./example/main.js");
  const queue = [mainAsset];

  for (const asset of queue) {
    asset.deps.forEach((relativePath) => {
      const child = createAsset(path.resolve("./example", relativePath));
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }

  return queue;
}
const graph = createGraph();

// 开始打包并利用ejs模板语句生成bundle
function build(graph) {
  const template = fs.readFileSync("./bundle.ejs", { encoding: "utf-8" });
  const data = graph.map((asset) => {
    const { id, code, mapping } = asset;
    return {
      id,
      code,
      mapping,
    };
  });
  const code = ejs.render(template, { data });
  fs.writeFileSync("./dist/bundle.js", code);
}

build(graph);
