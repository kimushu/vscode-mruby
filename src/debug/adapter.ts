import * as nls from "vscode-nls";
/*const localize = */nls.config({ messageFormat: nls.MessageFormat.file })();

import { MrubyDebugSession } from "./mrubyDebugSession";
MrubyDebugSession.run(MrubyDebugSession);
