'use strict';

import * as path from 'path';

import vscode = require('vscode');
import cp = require('child_process');
import { Proto3CompletionItemProvider } from './proto3Suggest';
import { Proto3Compiler } from './proto3Compiler';
import { PROTO3_MODE } from './proto3Mode';
import { Proto3DefinitionProvider } from './proto3Definition';
import { Proto3DocumentSymbolProvider } from './proto3SymbolProvider';
import { Proto3RenameProvider } from './proto3Rename';
import { Proto3Linter } from './proto3Lint';

export function activate(ctx: vscode.ExtensionContext): void {

    ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(PROTO3_MODE, new Proto3CompletionItemProvider(), '.', '\"'));
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(PROTO3_MODE, new Proto3DefinitionProvider()));
    ctx.subscriptions.push(vscode.languages.registerRenameProvider(PROTO3_MODE, new Proto3RenameProvider()));

    const diagnosticCollection = vscode.languages.createDiagnosticCollection("proto3-lint");

    vscode.languages.registerDocumentSymbolProvider('proto3', new Proto3DocumentSymbolProvider())

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        vscode.commands.executeCommand('proto3.lint');
    });

    vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor | undefined) => {
        vscode.commands.executeCommand('proto3.lint');
    });

    ctx.subscriptions.push(vscode.commands.registerCommand('proto3.compile.one', () => {
        const currentFile = vscode.window.activeTextEditor?.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFile.uri);
        const compiler = new Proto3Compiler(workspaceFolder);
        compiler.compileActiveProto();
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('proto3.compile.all', () => {
        const currentFile = vscode.window.activeTextEditor?.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFile.uri);
        const compiler = new Proto3Compiler(workspaceFolder);
        compiler.compileAllProtos();
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand('proto3.lint', () => {
        const currentFile = vscode.window.activeTextEditor?.document;
        if (currentFile.languageId != 'proto3') { return; }
        const linter = new Proto3Linter(currentFile, diagnosticCollection);
        linter.lint();
    }));

    vscode.languages.setLanguageConfiguration(PROTO3_MODE.language, {
        indentationRules: {
            // ^(.*\*/)?\s*\}.*$
            decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
            // ^.*\{[^}'']*$
            increaseIndentPattern: /^.*\{[^}'']*$/
        },
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)(\.proto){0,1}/g,
        comments: {
            lineComment: '//',
            blockComment: ['/*', '*/']
        },
        brackets: [
            ['{', '}'],
            ['[', ']'],
            ['(', ')'],
            ['<', '>'],
        ],

        __electricCharacterSupport: {
            brackets: [
                { tokenType: 'delimiter.curly.ts', open: '{', close: '}', isElectric: true },
                { tokenType: 'delimiter.square.ts', open: '[', close: ']', isElectric: true },
                { tokenType: 'delimiter.paren.ts', open: '(', close: ')', isElectric: true }
            ]
        },

        __characterPairSupport: {
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '`', close: '`', notIn: ['string'] },
                { open: '"', close: '"', notIn: ['string'] },
                { open: '\'', close: '\'', notIn: ['string', 'comment'] }
            ]
        }
    });

    vscode.languages.registerDocumentFormattingEditProvider('proto3', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            let args = [];
            let opts = { input: document.getText() };

            // In order for clang-format to find the correct formatting file we need to have cwd set appropriately
            switch (document.uri.scheme) {
                case "untitled": // File has not yet been saved to disk use workspace path
                    opts['cwd'] = vscode.workspace.rootPath;
                    args.push(`--assume-filename=untitled.proto`);
                    break;
                case "file": // File is on disk use it's directory
                    opts['cwd'] = path.dirname(document.uri.fsPath);
                    args.push(`--assume-filename=${document.uri.fsPath}`);
                    break;
            }

            let style = vscode.workspace.getConfiguration('clang-format', document).get<string>('style');
            style = style && style.trim();
            if (style) args.push(`-style=${style}`);

            let stdout = cp.execFileSync('clang-format', args, opts);
            return [new vscode.TextEdit(document.validateRange(new vscode.Range(0, 0, Infinity, Infinity)), stdout ? stdout.toString() : '')];
        },
    });
}

function deactivate() {
    //
}
