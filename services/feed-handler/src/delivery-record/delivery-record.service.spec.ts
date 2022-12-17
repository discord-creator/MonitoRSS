import { getRepositoryToken } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  clearDatabase,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared";
import { DeliveryRecordService } from "./delivery-record.service";
import { DeliveryRecord } from "./entities";
import dayjs from "dayjs";

describe("DeliveryRecordService", () => {
  let service: DeliveryRecordService;
  let deliveryRecordRepo: EntityRepository<DeliveryRecord>;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [DeliveryRecordService],
      },
      {
        models: [DeliveryRecord],
      }
    );

    const { module } = await init();

    service = module.get<DeliveryRecordService>(DeliveryRecordService);
    deliveryRecordRepo = module.get<EntityRepository<DeliveryRecord>>(
      getRepositoryToken(DeliveryRecord.name)
    );
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("store", () => {
    it("stores sent article states correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Sent,
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Sent,
        },
      ];
      await service.store(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      expect(records).toHaveLength(2);
      const ids = records.map((record) => record.id);
      expect(ids).toEqual(["1", "2"]);
      const feedIds = records.map((record) => record.feed_id);
      expect(feedIds).toEqual([feedId, feedId]);
      const statuses = records.map((record) => record.status);
      expect(statuses).toEqual([
        ArticleDeliveryStatus.Sent,
        ArticleDeliveryStatus.Sent,
      ]);
    });

    it("stores failed articles correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "internal-message",
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: "internal-message-2",
        },
      ];
      await service.store(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      expect(records).toHaveLength(2);
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            feed_id: feedId,
            status: ArticleDeliveryStatus.Failed,
            error_code: ArticleDeliveryErrorCode.NoChannelOrWebhook,
            internal_message: "internal-message",
          }),
          expect.objectContaining({
            feed_id: feedId,
            status: ArticleDeliveryStatus.Failed,
            error_code: ArticleDeliveryErrorCode.Internal,
            internal_message: "internal-message-2",
          }),
        ])
      );
    });

    it("stores rejected articles correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryRejectedCode.BadRequest,
          internalMessage: "internal-message",
        },
        {
          id: "2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.Rejected,
          errorCode: ArticleDeliveryRejectedCode.BadRequest,
          internalMessage: "internal-message-2",
        },
      ];
      await service.store(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      expect(records).toHaveLength(2);
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            feed_id: feedId,
            status: ArticleDeliveryStatus.Rejected,
            error_code: ArticleDeliveryRejectedCode.BadRequest,
            internal_message: "internal-message",
          }),
          expect.objectContaining({
            feed_id: feedId,
            status: ArticleDeliveryStatus.Rejected,
            error_code: ArticleDeliveryRejectedCode.BadRequest,
            internal_message: "internal-message-2",
          }),
        ])
      );
    });

    it("stores other article states correctly correctly", async () => {
      const feedId = "feed-id";
      const articleStates: ArticleDeliveryState[] = [
        {
          id: "id-1",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.FilteredOut,
        },
        {
          id: "id-2",
          mediumId: "medium-id",
          status: ArticleDeliveryStatus.FilteredOut,
        },
      ];
      await service.store(feedId, articleStates);

      const records = await deliveryRecordRepo.findAll();

      expect(records).toHaveLength(2);
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            feed_id: feedId,
            status: ArticleDeliveryStatus.FilteredOut,
          }),
          expect.objectContaining({
            feed_id: feedId,
            status: ArticleDeliveryStatus.FilteredOut,
          }),
        ])
      );
    });
  });

  describe("countDeliveriesInPastTimeframe", () => {
    it("returns the correct number of sent and rejected deliveries", async () => {
      const feedId = "feed-id";

      const [record1, record2, record3] = [
        new DeliveryRecord(
          {
            id: "1",
            feed_id: feedId,
            status: ArticleDeliveryStatus.Sent,
          },
          {
            created_at: dayjs().subtract(1, "hour").toDate(),
          }
        ),
        new DeliveryRecord(
          {
            id: "2",

            feed_id: feedId,
            status: ArticleDeliveryStatus.Rejected,
          },
          {
            created_at: dayjs().subtract(1, "hour").toDate(),
          }
        ),
        new DeliveryRecord(
          {
            id: "3",
            feed_id: feedId,
            status: ArticleDeliveryStatus.Sent,
          },
          {
            created_at: dayjs().subtract(1, "day").toDate(),
          }
        ),
      ];

      await deliveryRecordRepo.persistAndFlush([record1, record2, record3]);

      const count = await service.countDeliveriesInPastTimeframe(
        { feedId },
        60 * 60 * 2 // 2 hours
      );

      expect(count).toBe(2);
    });
  });
});
