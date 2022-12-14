function findFormCreate(context, node) {
  const name = node?.id?.name || node?.parent?.id?.name;
  const variable = context.getDeclaredVariables(node)?.find((x) => x.name === name);
  if (variable?.references?.length !== 1) {
    return false;
  }
  // @ts-ignore
  const call = variable?.references[0]?.identifier?.parent;
  const callee = call?.callee?.callee;
  return callee?.object?.name === "Form" && callee?.property?.name === "create" ? call : undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    fixable: "code",
  },
  create(context) {
    return {
      "FunctionDeclaration, ArrowFunctionExpression"(node) {
        if (!findFormCreate(context, node)) {
          return;
        }

        const removes = [];
        let shouldReport = false;
        let addUseForm = false;
        let objectPatternText = "";
        for (const p of node?.params?.[0]?.properties || []) {
          if (p?.key?.name !== "form") {
            continue;
          }
          shouldReport = true;
          if (p?.value?.name === "form") {
            addUseForm = true;
            removes.push(p);
            const nextToken = context.getSourceCode().getTokenAfter(p);
            if (nextToken.value === ",") {
              removes.push(nextToken);
            }
          }
          if (p?.value?.type === "ObjectPattern") {
            addUseForm = true;
            removes.push(p);
            const nextToken = context.getSourceCode().getTokenAfter(p);
            if (nextToken.value === ",") {
              removes.push(nextToken);
            }
            objectPatternText = context.getSourceCode().getText(p.value);
          }
        }

        context.report({
          node: node.params[0],
          message: "Should not have `form` at props",
          fix(fixer) {
            if (node.body?.type !== "BlockStatement") {
              return;
            }
            const functionStart = context.getSourceCode().getFirstToken(node.body);
            const fixes = [
              ...removes.map((r) => fixer.remove(r)),
              fixer.insertTextAfter(
                functionStart,
                (addUseForm ? "\nconst [form] = Form.useForm();\n" : "") +
                  (objectPatternText ? `\nconst ${objectPatternText} = form;\n` : "")
              ),
              fixer.remove(findFormCreate(context, node).callee),
            ];
            return fixes;
          },
        });
      },

      JSXElement(node) {
        const container = node.children?.find((x) => x.type === "JSXExpressionContainer");
        if (!container) {
          return;
        }
        if (container.expression.callee?.callee?.name !== "getFieldDecorator") {
          return;
        }
        context.report({
          message: "Should upgrade getFieldDecorator to antd@4",
          node,
          fix(fixer) {
            const argument = container.expression.arguments[0];
            if (!argument || argument.type !== "JSXElement") {
              return;
            }
            const name =
              container.expression?.callee?.arguments?.[0]?.value ||
              container.expression?.callee?.arguments?.[0]?.quasis?.[0]?.value?.cooked;
            if (!name) {
              return;
            }
            const properties = container.expression?.callee?.arguments?.[1]?.properties;
            let unfixable = false;
            const props =
              properties
                ?.map((x) => {
                  if (x.key.type !== "Identifier") {
                    unfixable = true;
                    return;
                  }
                  return `${x.key.name}={` + context.getSourceCode().getText(x.value) + "}";
                })
                .join(" ") || "";
            if (unfixable) {
              return;
            }
            return [
              fixer.replaceText(
                node.openingElement,
                context.getSourceCode().getText(node.openingElement).slice(0, -1) +
                  ` name="${name}"` +
                  (props ? ` ${props}` : "") +
                  ">"
              ),
              fixer.replaceText(container, context.getSourceCode().getText(argument)),
            ];
          },
        });
      },
    };
  },
};

module.exports = rule;
