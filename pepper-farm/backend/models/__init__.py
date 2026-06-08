# Import every ORM model so they are all registered in Base.metadata.
# This file must be imported (directly or via `import models`) before any
# call to Base.metadata.create_all() — especially in test setup.
# Without these imports, tables whose models haven't been touched yet are
# silently absent from the metadata and are never created.

from models.role import Role  # noqa: F401
from models.user import User  # noqa: F401
from models.email_log import EmailLog  # noqa: F401
from models.newsletter_template import NewsletterTemplate  # noqa: F401
from models.notification import Notification  # noqa: F401
from models.pepper_variety import PepperVariety  # noqa: F401
from models.pepper_edit_log import PepperEditLog  # noqa: F401
from models.plant import Plant  # noqa: F401
from models.farm_zone import FarmZone  # noqa: F401
from models.task import Task, TaskChecklistItem  # noqa: F401
from models.inventory import Inventory  # noqa: F401
from models.product import Product  # noqa: F401
from models.sensor import (  # noqa: F401
    Sensor,
    SensorAssignment,
    SensorReading,
    SensorSyncState,
    SensorAlert,
    RecurrenceConfig,
)
from models.spray import (  # noqa: F401
    Pesticide,
    SprayReport,
    SprayAlert,
    OverdueSprayAlert,
)
from models.cart import CartItem  # noqa: F401
from models.order import Order, OrderItem  # noqa: F401
from models.payment import PaymentRecord  # noqa: F401
from models.coupon import Coupon, CouponRedemption  # noqa: F401
from models.employee_discount import (  # noqa: F401
    EmployeeDiscountSetting,
    EmployeeDiscountProductOverride,
)
