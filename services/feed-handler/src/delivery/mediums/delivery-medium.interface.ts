import { Article, FeedV2Event, MediumPayload } from "../../shared";
import { ArticleDeliveryState } from "../types";

export interface DeliveryMedium {
  deliverArticle(
    article: Article,
    details: {
      deliveryId: string;
      mediumId: string;
      feedDetails: FeedV2Event["data"]["feed"];
      deliverySettings: MediumPayload["details"];
    }
  ): Promise<ArticleDeliveryState>;
}
