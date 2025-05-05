"use strict";

import vscode = require("vscode");
import cp = require("child_process");
import path = require("path");

import { Proto3Configuration } from "./proto3Configuration";
import { Proto3Import } from "./proto3Import";

export class Proto3Compiler {
    private _config: Proto3Configuration;
    private _isProtocInPath: boolean;

    constructor(workspaceFolder?: vscode.WorkspaceFolder) {
        this._config = Proto3Configuration.Instance(workspaceFolder);
        try {
            cp.execFileSync("protoc", ["-h"]);
            this._isProtocInPath = true;
        } catch (e) {
            this._isProtocInPath = false;
        }
    }

    public compileAllProtos() {
        let args = this._config.getProtocOptions();
        // Compile in batch produces errors. Must be 1 by 1.
        this._config.getAllProtoPaths().forEach((proto) => {
            this.runProtoc(args.concat(proto), undefined, (stdout, stderr) => {
                vscode.window.showErrorMessage(stderr);
            });
        });
    }

    public compileActiveProto() {
        let editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId == "proto3") {
            let fileName = editor.document.uri.fsPath;
            let args = this._config.getProtocOptions().concat(fileName);

            this.runProtoc(args, undefined, (stdout, stderr) => {
                vscode.window.showErrorMessage(stderr);
            });
        }
    }

    private runProtoc(args: string[], opts?: cp.ExecFileOptions, callback?: (stdout: string, stderr: string) => void) {
        let protocPath = this._config.getProtocPath(this._isProtocInPath);
        if (protocPath == "?") {
            return; // protoc is not configured
        }

        if (!opts) {
            opts = {};
        }

        const activeWorkspaceFolder = Proto3Import.getActiveWorkspaceFolder();

        opts = Object.assign(opts, { cwd: activeWorkspaceFolder.uri.fsPath });

        cp.execFile(protocPath, args, opts, (err, stdout, stderr) => {
            if (err && stdout.length == 0 && stderr.length == 0) {
                // Assume the OS error if no messages to buffers because
                // "err" does not provide error type info.
                vscode.window.showErrorMessage(err.message);
                console.error(err);
                return;
            }
            if (callback) {
                callback(stdout, stderr);
            }
        });
    }
}
