import { launchApplication } from "./app/composition";

const application = launchApplication();
import.meta.hot?.dispose(() => application.dispose());
