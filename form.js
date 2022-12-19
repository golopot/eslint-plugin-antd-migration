/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {*} node
 * @returns
 */
function findFormCreate(context, node) {
  let name;
  let variable;
  if (node.type === "FunctionDeclaration") {
    name = node?.id?.name;
    variable = context.getDeclaredVariables(node)?.find((x) => x.name === name);
  } else if (node.type === "ArrowFunctionExpression") {
    name = node?.parent?.id?.name;
    variable = context.getDeclaredVariables(node.parent)?.find((x) => x.name === name);
  }
  // @ts-ignore
  const ref = variable?.references?.find((x) => x.identifier?.parent?.type === "CallExpression");
  // @ts-ignore
  const call = ref?.identifier?.parent;
  const callee = call?.callee?.callee;
  return callee?.object?.name === "Form" && callee?.property?.name === "create" ? call : undefined;
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {*} node
 * @returns
 */
function removeProperty(context, node) {
  const nextToken = context.getSourceCode().getTokenAfter(node);
  if (nextToken.value === ",") {
    return [node, nextToken];
  }
  return [node];
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @param {*} node
 * @returns
 */
function handleFunctionParamEmptyPattern(context, node) {
  if (
    node?.params?.length === 1 &&
    node?.params[0]?.type === "ObjectPattern" &&
    node?.params[0]?.properties?.length === 0
  ) {
    context.report({
      node: node?.params[0],
      message: "remove empty pattern",
      fix(fixer) {
        return fixer.remove(node.params[0]);
      },
    });
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    fixable: "code",
  },
  create(context) {
    return {
      "FunctionDeclaration, ArrowFunctionExpression"(node) {
        handleFunctionParamEmptyPattern(context, node);
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
            removes.push(...removeProperty(context, p));
          }
          if (p?.value?.type === "ObjectPattern") {
            addUseForm = true;
            removes.push(...removeProperty(context, p));
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
                (addUseForm ? "\nconst [form] = Form.useForm();" : "") +
                  (objectPatternText ? `const ${objectPatternText} = form;` : "")
              ),
              fixer.remove(findFormCreate(context, node).callee),
            ];
            return fixes;
          },
        });
      },

      ObjectPattern(node) {
        // @ts-ignore
        if (node.parent?.init?.name === "form") {
          for (const p of node.properties) {
            // @ts-ignore
            if (p.key?.name === "getFieldDecorator" && p.value?.name === "getFieldDecorator") {
              context.report({
                node: p,
                message: "remove getFieldDecorator",
                fix(fixer) {
                  return removeProperty(context, p).map((x) => fixer.remove(x));
                },
              });
            }
          }

          if (node.properties.length === 0 && node.parent.parent.type === "VariableDeclaration") {
            context.report({
              node: node.parent.parent,
              message: "remove empty form destrucutring",
              fix(fixer) {
                return fixer.remove(node.parent.parent);
              },
            });
          }
        }
      },

      JSXElement(node) {
        const container = node.children?.find((x) => x.type === "JSXExpressionContainer");
        if (!container) {
          return;
        }
        if (container.expression.callee?.callee?.name !== "getFieldDecorator") {
          return;
        }

        function getNameText(node) {
          if (node?.type === "Literal" && typeof node?.value === "string") {
            return context.getSourceCode().getText(node);
          }
          return "{" + context.getSourceCode().getText(node) + "}";
        }
        context.report({
          message: "Should upgrade getFieldDecorator to antd@4",
          node,
          fix(fixer) {
            const argument = container.expression.arguments[0];
            if (!argument || argument.type !== "JSXElement") {
              return;
            }
            const name = getNameText(container?.expression?.callee?.arguments?.[0]);
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
                  ` name=${name}` +
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
