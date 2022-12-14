function isUsedByFormCreate(context, node) {
  const name = node?.id?.name || node?.parent?.id?.name;
  const variable = context.getDeclaredVariables(node)?.find((x) => x.name === name);
  if (variable?.references?.length !== 1) {
    return false;
  }
  // @ts-ignore
  const callee = variable?.references[0]?.identifier?.parent?.callee?.callee;
  return callee?.object?.name === "Form" && callee?.property?.name === "create";
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    fixable: "code",
  },
  create(context) {
    return {
      "FunctionDeclaration, ArrowFunctionExpression"(node) {
        if (!isUsedByFormCreate(context, node)) {
          return;
        }
        const form = node?.params?.[0]?.properties?.find((x) => x?.key?.name === "form");
        if (!form) {
          return;
        }

        const removes = [];
        let shouldReport = false;
        let addUseForm = false;
        let objectPatternText = "";
        for (const x of node?.params?.[0]?.properties || []) {
          if (x?.key?.name !== "form") {
            continue;
          }
          shouldReport = true;
          if (form?.value?.name === "form") {
            addUseForm = true;
            removes.push(form);
            const nextToken = context.getSourceCode().getTokenAfter(form);
            if (nextToken.value === ",") {
              removes.push(nextToken);
            }
          }
          if (form?.value?.type === "ObjectPattern") {
            addUseForm = true;
            removes.push(form);
            const nextToken = context.getSourceCode().getTokenAfter(form);
            if (nextToken.value === ",") {
              removes.push(nextToken);
            }
            objectPatternText = context.getSourceCode().getText(form.value);
          }
        }

        context.report({
          node: form,
          message: "Should not have `form` at function params",
          fix(fixer) {
            if (node.body?.type !== "BlockStatement") {
              return;
            }
            const fixes = [
              ...removes.map((r) => fixer.remove(r)),
              fixer.insertTextAfter(
                context.getSourceCode().getFirstToken(node.body),
                (addUseForm ? "\nconst [form] = Form.useForm();\n" : "") +
                  (objectPatternText ? `\nconst ${objectPatternText} = form;\n` : "")
              ),
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
