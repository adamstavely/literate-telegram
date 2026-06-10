import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { registerInteropElements } from './app/shared/elements';

bootstrapApplication(AppComponent, appConfig)
  .then(appRef => {
    registerInteropElements(appRef.injector);
  })
  .catch(console.error);
