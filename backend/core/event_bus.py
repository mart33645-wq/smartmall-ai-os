import json
import os
import time
from typing import Any, Callable, Optional


class EventBus:
    """RabbitMQ topic exchange with in-memory fallback when broker is down."""

    def __init__(self) -> None:
        self.url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
        self._connection = None
        self._channel = None
        self._mock = True
        self._tried_connect = False

    def _ensure_channel(self) -> None:
        if self._tried_connect:
            return
        self._tried_connect = True
        if os.getenv("DISABLE_EVENT_BUS", "").lower() in ("1", "true", "yes"):
            print("EventBus: DISABLE_EVENT_BUS set — using mock only")
            return
        try:
            import pika  # noqa: WPS433

            params = pika.URLParameters(self.url)
            for attempt in range(2):
                try:
                    self._connection = pika.BlockingConnection(params)
                    self._channel = self._connection.channel()
                    self._channel.exchange_declare(exchange="smartmall_events", exchange_type="topic")
                    self._mock = False
                    print("EventBus connected to RabbitMQ")
                    return
                except Exception as exc:
                    print(f"RabbitMQ connection failed ({exc}); retrying…")
                    time.sleep(1.5)
        except Exception as exc:
            print(f"EventBus: RabbitMQ unavailable ({exc}). Mock mode.")
        self._mock = True

    def publish(self, routing_key: str, message: dict[str, Any]) -> None:
        self._ensure_channel()
        if self._mock or not self._channel:
            print(f"[MOCK BUS] {routing_key} -> {message}")
            return
        try:
            import pika  # noqa: WPS433

            self._channel.basic_publish(
                exchange="smartmall_events",
                routing_key=routing_key,
                body=json.dumps(message),
                properties=pika.BasicProperties(delivery_mode=2),
            )
        except Exception as exc:
            print(f"Event publish error ({exc}); falling back to log")
            print(f"[MOCK BUS] {routing_key} -> {message}")

    def subscribe(self, routing_key: str, callback: Callable[[dict], None]) -> None:
        self._ensure_channel()
        if self._mock or not self._channel:
            print(f"[MOCK BUS] subscribe {routing_key} (no broker)")
            return
        import pika  # noqa: WPS433

        result = self._channel.queue_declare(queue="", exclusive=True)
        queue_name = result.method.queue
        self._channel.queue_bind(exchange="smartmall_events", queue=queue_name, routing_key=routing_key)

        def _cb(ch, method, properties, body):  # noqa: ARG001
            callback(json.loads(body))

        self._channel.basic_consume(queue=queue_name, on_message_callback=_cb, auto_ack=True)
        self._channel.start_consuming()


event_bus: EventBus = EventBus()
