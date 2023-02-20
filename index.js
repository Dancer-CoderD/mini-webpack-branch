import fs from "fs";
import ejs from "ejs";
import path from "path";
import parser from "@babel/parser";
import traverse from "@babel/traverse";
import { transformFromAst } from "babel-core";

let id = 0;

// 处理静态资源
function createAsset(filePath) {
  // 1. 获取文件的内容

  const source = fs.readFileSync(filePath, {
    encoding: "utf-8", // 将buffer转为utf8
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
