import { Socket } from 'socket.io';
import { applicationService } from './application.service';
import { ForbiddenError } from '../../shared/errors';

export class FeatureGuardService {
  /**
   * Centralized feature check asserting if a tenant application has a service enabled.
   * Throws ForbiddenError if the service feature is disabled for the application.
   */
  public async assertFeature(socket: Socket, featureName: string): Promise<void> {
    const applicationId = socket.data.applicationId as string | undefined;
    if (!applicationId) {
      throw new ForbiddenError('Unauthenticated socket request');
    }

    const app = await applicationService.getApp(applicationId);
    if (!app || !app.enabled) {
      throw new ForbiddenError(`Application '${applicationId}' is disabled or not found`);
    }

    // If tenant explicitly configured the feature to false, block access
    if (app.features && app.features[featureName] === false) {
      throw new ForbiddenError(`Service feature '${featureName}' is disabled for application '${applicationId}'`);
    }
  }
}

export const featureGuardService = new FeatureGuardService();
