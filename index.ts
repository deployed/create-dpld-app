#!/usr/bin/env node

import fs from "fs";
import path from "path";
import prompts from "prompts";

interface Template {
  templateDir: string;
}
type TemplateChoiceTuple = [string, TemplateMap];
type TemplateMap = Map<string, TemplateChoiceTuple | Template>;
const TEMPLATES = new Map<string, TemplateChoiceTuple>([
  ['root', ['Choose app type:', new Map([
    ['SSR/SSG', ['Choose framework/library:', new Map([
      ['Next.js', ['Choose style engine:', new Map([
        ['tailwind', {
          templateDir: 'next-tailwind',
        }],
      ])]],
    ])]]
  ])]],
]);

const FILES_TO_RENAME = new Map([["_gitignore", ".gitignore"]]);

(async () => {
  const selectedTemplate = await chooseTemplate(TEMPLATES.get("root")!);
  const projectName = toValidPackageName(await chooseProjectName());
  if (fs.existsSync(projectName) && !isEmpty(projectName)) {
    const overwrite = await confirmOverwrite(projectName);
    if (!overwrite) {
      return;
    }
    fs.rmSync(projectName, { recursive: true });
  }
  copyTemplate(selectedTemplate, projectName);
})();

async function chooseTemplate([
  prompt,
  templateMap,
]: TemplateChoiceTuple): Promise<Template> {
  const choices = Array.from(templateMap).map(([key, value]) => ({
    title: key,
    value: value,
  }));

  const { choice }: { choice: TemplateChoiceTuple | Template } = await prompts({
    type: "select",
    name: "choice",
    message: prompt,
    choices: choices,
  });

  if (Array.isArray(choice)) {
    return chooseTemplate(choice);
  }
  return choice;
}

async function chooseProjectName(): Promise<string> {
  const { projectName }: { projectName: string } = await prompts({
    type: "text",
    name: "projectName",
    message: "Project name:",
    initial: "dpld-app",
  });
  return projectName;
}

async function confirmOverwrite(path: string): Promise<boolean> {
  const { overwrite }: { overwrite: boolean } = await prompts({
    type: "confirm",
    name: "overwrite",
    message: `Directory ${path} is not empty. Remove existing files and continue?`,
  });
  return overwrite;
}

function isEmpty(path: string) {
  const files = fs.readdirSync(path);
  return files.length === 0 || (files.length === 1 && files[0] === ".git");
}

function copyDir(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file);
    const destFile = path.resolve(destDir, file);
    copy(srcFile, destFile);
  }
}

function copy(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDir(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
}

function copyTemplate(template: Template, projectName: string) {
  const templateDir = `./templates/${template.templateDir}`;
  fs.mkdirSync(projectName);
  fs.readdirSync(templateDir).forEach((file) => {
    if (file === "package.json") {
      const packageJson = JSON.parse(
        fs.readFileSync(`${templateDir}/package.json`, "utf8")
      );
      packageJson.name = projectName;
      fs.writeFileSync(
        `${projectName}/package.json`,
        JSON.stringify(packageJson, null, 2)
      );
      return;
    }
    copy(
      `${templateDir}/${file}`,
      `${projectName}/${FILES_TO_RENAME.get(file) ?? file}`
    );
  });
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[._]/, "")
    .replace(/[^a-z\d\-~]+/g, "-");
}
