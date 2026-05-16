from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from database import Base


class Sensor(Base):
    __tablename__ = "Sensors"

    SensorId = Column(Integer, primary_key=True, autoincrement=True)
    MacAddress = Column(String(50), nullable=False, unique=True)
    DeviceName = Column(String(100), nullable=True)
    UnitName = Column(String(100), nullable=True)
    BusinessUnitId = Column(String(100), nullable=True)
    GatewayId = Column(String(100), nullable=True)
    SensorType = Column(String(50), nullable=True)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())


class SensorAssignment(Base):
    __tablename__ = "SensorAssignments"

    AssignmentId = Column(Integer, primary_key=True, autoincrement=True)
    SensorId = Column(Integer, ForeignKey("Sensors.SensorId"), nullable=False)
    PlantId = Column(Integer, ForeignKey("Plants.PlantId"), nullable=True)
    PepperId = Column(Integer, ForeignKey("PepperVarieties.PepperId"), nullable=True)
    ZoneId = Column(Integer, ForeignKey("FarmZones.ZoneId"), nullable=True)
    AssignedFromUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    AssignedToUtc = Column(DateTime, nullable=True)
    IsActive = Column(Boolean, nullable=False, default=True)


class SensorReading(Base):
    __tablename__ = "SensorReadings"

    ReadingId = Column(Integer, primary_key=True, autoincrement=True)

    SensorId = Column(Integer, ForeignKey("Sensors.SensorId"), nullable=False)
    MacAddress = Column(String(50), nullable=False)
    DeviceName = Column(String(100), nullable=True)

    Temperature = Column(Float, nullable=True)
    Humidity = Column(Float, nullable=True)
    Leak = Column(Float, nullable=True)
    VibrationSD = Column(Float, nullable=True)
    BatteryLevel = Column(Float, nullable=True)
    PAR = Column(Float, nullable=True)

    SampleTimeUtc = Column(DateTime, nullable=False)
    GatewayReadTimeUtc = Column(DateTime, nullable=True)
    AtomationCreatedAtUtc = Column(DateTime, nullable=True)

    ReadingType = Column(String(50), nullable=True)
    TriggersJson = Column(Text, nullable=True)

    Latitude = Column(Float, nullable=True)
    Longitude = Column(Float, nullable=True)

    RawJson = Column(Text, nullable=False)
    InsertedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())

    __table_args__ = (
        UniqueConstraint(
            "SensorId",
            "SampleTimeUtc",
            "ReadingType",
            name="UX_SensorReadings_Sensor_SampleTime_Type",
        ),
    )


class SensorSyncState(Base):
    __tablename__ = "SensorSyncState"

    SyncStateId = Column(Integer, primary_key=True, autoincrement=True)
    SensorId = Column(Integer, ForeignKey("Sensors.SensorId"), nullable=False, unique=True)

    LastSampleTimeUtc = Column(DateTime, nullable=True)
    LastAtomationCreatedAtUtc = Column(DateTime, nullable=True)
    LastSuccessfulSyncUtc = Column(DateTime, nullable=True)

    LastSyncStatus = Column(String(50), nullable=True)
    LastError = Column(Text, nullable=True)


class SensorAlert(Base):
    __tablename__ = "SensorAlerts"

    AlertId = Column(Integer, primary_key=True, autoincrement=True)

    SensorId = Column(Integer, ForeignKey("Sensors.SensorId"), nullable=False)
    ReadingId = Column(Integer, ForeignKey("SensorReadings.ReadingId"), nullable=False)
    PepperId = Column(Integer, ForeignKey("PepperVarieties.PepperId"), nullable=True)

    MetricName = Column(String(50), nullable=False)
    ActualValue = Column(Float, nullable=False)
    MinAllowed = Column(Float, nullable=True)
    MaxAllowed = Column(Float, nullable=True)

    Severity = Column(String(20), nullable=False, default="warning")
    Message = Column(String(500), nullable=False)

    IsResolved = Column(Boolean, nullable=False, default=False)
    CreatedAtUtc = Column(DateTime, nullable=False, server_default=func.sysutcdatetime())
    ResolvedAtUtc = Column(DateTime, nullable=True)
    IsRecurring = Column(Boolean, nullable=True, default=False)