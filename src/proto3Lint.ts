'use strict';

import cp = require("child_process");
import vscode = require("vscode");
import path = require("path");
import util = require("util");

interface ProtoError {
    line: number;
    reason: string;
}

interface Proto3LinterError {
    proto: ProtoError;
    range: vscode.Range;
}


export class Proto3Linter {
    private codeDocument: vscode.TextDocument;
    private collection: vscode.DiagnosticCollection;

    constructor(document: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
        this.codeDocument = document;
        this.collection = collection;
    }

    public async lint(): Promise<void> {
        const errors: Proto3LinterError[] = await this.obtainErrors();
        const diagnostics = errors.map(error => {
            return new vscode.Diagnostic(error.range, error.proto.reason, vscode.DiagnosticSeverity.Warning);
        });

        this.collection.set(this.codeDocument.uri, diagnostics);
    }

    private async obtainErrors(): Promise<Proto3LinterError[]> {
        const result = await this.runProtoLint();
        if (!result) {
            return [];
        }

        const lintingErrors: Proto3LinterError[] = this.parseErrors(result);

        // When errors exist, but no linting errors were returned show the error window
        // in VSCode as it is most likely an issue with the binary itself such as not being
        // able to find a configuration or a file to lint.
        if (lintingErrors.length === 0) {
            vscode.window.showErrorMessage("protolint: " + result);
            return [];
        }

        return lintingErrors;
    }

    private async runProtoLint(): Promise<string> {
        if (!vscode.workspace.workspaceFolders) {
            return "";
        }

        let currentFile = this.codeDocument.uri.fsPath;
        let currentDirectory = path.dirname(currentFile);

        let protoLintPath = vscode.workspace.getConfiguration("protolint").get<string>("path");
        if (!protoLintPath) {
            protoLintPath = "protolint";
        }

        const cmd = `${protoLintPath} lint "${currentFile}"`;

        // Execute the protolint binary and store the output from standard error.
        //
        // The output could either be an error from using the binary improperly, such as unable to find
        // a configuration, or linting errors.
        const exec = util.promisify(cp.exec);
        let lintResults: string = "";

        await exec(cmd, {
            cwd: currentDirectory,
        }).catch((error: any) => (lintResults = error.stderr));

        return lintResults;
    }

    private parseErrors(errorStr: string): Proto3LinterError[] {
        let errors = errorStr.split("\n") || [];

        var result = errors.reduce((errors: Proto3LinterError[], currentError: string) => {
            const parsedError = this.parseProtoError(currentError);
            if (!parsedError.reason) {
                return errors;
            }

            const linterError: Proto3LinterError = {
                proto: parsedError,
                range: this.codeDocument.lineAt(parsedError.line - 1).range,
            };

            return errors.concat(linterError);
        }, []);

        return result;
    }

    // parseProtoError takes the an error message from protolint
    // and attempts to parse it as a linting error.
    //
    // Linting errors are in the format:
    // [path/to/file.proto:line:column] an error message is here
    private parseProtoError(error: string): ProtoError {
        if (!error) {
            const protoError: ProtoError = {
                line: 0,
                reason: "",
            };

            return protoError;
        }

        const errorLine = parseInt(error.split(".proto:")[1], 10);
        const errorReason = error.split("] ")[1];

        const protoError: ProtoError = {
            line: errorLine,
            reason: errorReason,
        };

        return protoError;
    }

}
