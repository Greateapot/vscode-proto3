'use strict';

import path = require('path');
import vscode = require('vscode');

export namespace Proto3Import {

    export const importStatementRegex = new RegExp(/^\s*import\s+('|")(.+\.proto)('|")\s*;\s*$/gim);

    export const getImportedFilePathsOnDocument = (document: vscode.TextDocument) => {

        const activeWorkspaceFolder = Proto3Import.getActiveWorkspaceFolder();
        const fullDocument = document.getText();
        let importStatement: RegExpExecArray;
        let importPaths = [];
        while (importStatement = importStatementRegex.exec(fullDocument)) {
            const protoFileName = importStatement[2];
            const searchPath = path.join(activeWorkspaceFolder.uri.fsPath, '**', protoFileName);
            importPaths.push(searchPath);
        }
        return importPaths;
    }

    export const getActiveWorkspaceFolder = () => {
        let activeEditor = vscode.window.activeTextEditor;

        if (activeEditor == undefined) return undefined;

        let activeEditorUri = activeEditor.document.uri;
        let activeWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditorUri);

        return activeWorkspaceFolder;
    }
}
