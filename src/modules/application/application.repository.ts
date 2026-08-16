import { IApplicationRepository } from './IApplication';
import { InMemoryApplicationRepository } from './repositories/in-memory-application.repository';
// import { ApplicationRepository } from './repositories/application.repository';

// Central active application repository export.
// When migrating to SQL in the future, simply switch to ApplicationRepository!
export const applicationRepository: IApplicationRepository = new InMemoryApplicationRepository();
