class Scratch3ProcedureBlocks {
    runtime: any;
    constructor (runtime: any) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }
    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            procedures_definition: this.definition,
            procedures_definition_return: this.definition,
            procedures_call: this.call,
            procedures_call_return: this.callReturn,
            procedures_return: this.return,
            argument_reporter_string_number: this.argumentReporterStringNumber,
            argument_reporter_boolean: this.argumentReporterBoolean,
            argument_lambda: this.argumentLambda
        };
    }
    definition () {
        // No-op: execute the blocks.
    }
    // @ts-expect-error TS(2393): Duplicate function implementation.
    return () {
        // Todo
    }
    call (args: any, util: any) {
        if (util.stackFrame.executed !== util.currentBlockId) {
            const procedureCode = args.mutation.proccode;
            const paramNamesIdsAndDefaults = util.getProcedureParamNamesIdsAndDefaults(procedureCode);
            // If null, procedure could not be found, which can happen if custom
            // block is dragged between sprites without the definition.
            // Match Scratch 2.0 behavior and noop.
            if (paramNamesIdsAndDefaults === null) {
                return;
            }
            const [paramNames, paramIds, paramDefaults] = paramNamesIdsAndDefaults;
            // Initialize params for the current stackFrame to {}, even if the procedure does
            // not take any arguments. This is so that `getParam` down the line does not look
            // at earlier stack frames for the values of a given parameter (#1729)
            util.initParams();
            for (let i = 0; i < paramIds.length; i++) {
                if (args.hasOwnProperty(paramIds[i])) {
                    util.pushParam(paramNames[i], args[paramIds[i]]);
                } else {
                    util.pushParam(paramNames[i], paramDefaults[i]);
                }
            }
            const addonBlock = util.runtime.getAddonBlock(procedureCode);
            if (addonBlock) {
                const result = addonBlock.callback(util.thread.getAllparams(), util);
                if (util.thread.status === 1 /* STATUS_PROMISE_WAIT */) {
                    // If the addon block is using STATUS_PROMISE_WAIT to force us to sleep,
                    // make sure to not re-run this block when we resume.
                    util.stackFrame.executed = true;
                }
                return result;
            }
            util.startProcedure(procedureCode);
            util.stackFrame.executed = util.currentBlockId;
        }
    }
    callReturn (args: any, util: any) {
        if (util.stackFrame.executed !== util.currentBlockId) {
            const procedureCode = args.mutation.proccode;
            const paramNamesIdsAndDefaults = util.getProcedureParamNamesIdsAndDefaults(procedureCode);
            // If null, procedure could not be found, which can happen if custom
            // block is dragged between sprites without the definition.
            // Match Scratch 2.0 behavior and noop.
            if (paramNamesIdsAndDefaults === null) {
                return;
            }
            const [paramNames, paramIds, paramDefaults] = paramNamesIdsAndDefaults;
            // Initialize params for the current stackFrame to {}, even if the procedure does
            // not take any arguments. This is so that `getParam` down the line does not look
            // at earlier stack frames for the values of a given parameter (#1729)
            util.initParams();
            for (let i = 0; i < paramIds.length; i++) {
                if (args.hasOwnProperty(paramIds[i])) {
                    util.pushParam(paramNames[i], args[paramIds[i]]);
                } else {
                    util.pushParam(paramNames[i], paramDefaults[i]);
                }
            }
            util.stackFrame.executed = util.currentBlockId;
            // For the reason that the stack top is current command block,
            // rather than the call block, so we should push the block id.
            util.pushThreadStack(util.currentBlockId);
            util.startProcedure(procedureCode);
        }
    }
    // @ts-expect-error TS(2393): Duplicate function implementation.
    return (args: any, util: any) {
        util.pushReportedValue(args.VALUE);
        util.stopThisScript();
        // For the same reason in callReturn
        util.popThreadStack();
    }
    argumentReporterStringNumber (args: any, util: any) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // tw: support legacy block
            if (String(args.VALUE).toLowerCase() === 'last key pressed') {
                return util.ioQuery('keyboard', 'getLastKeyPressed');
            }
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }
    argumentReporterBoolean (args: any, util: any) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            // tw: implement is compiled? and is turbowarp?
            const lowercaseValue = String(args.VALUE).toLowerCase();
            if (util.target.runtime.compilerOptions.enabled && lowercaseValue === 'is compiled?') {
                return true;
            }
            if (lowercaseValue === 'is turbowarp?') {
                return true;
            }
            // When the parameter is not found in the most recent procedure
            // call, the default is always 0.
            return 0;
        }
        return value;
    }
    argumentLambda (args: any, util: any) {
        const value = util.getParam(args.VALUE);
        if (value === null) {
            return;
        }
        return value;
    }
}
export default Scratch3ProcedureBlocks;
