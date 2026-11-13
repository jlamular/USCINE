namespace WatchTogether.Core.Models;

public class ServiceResult
{
    public bool Succeeded { get; }

    public ServiceErrorType ErrorType { get; }

    public IReadOnlyList<string> Errors { get; }

    protected ServiceResult(bool succeeded, ServiceErrorType errorType, IReadOnlyList<string> errors)
    {
        Succeeded = succeeded;
        ErrorType = errorType;
        Errors = errors;
    }

    public static ServiceResult Success()
    {
        return new ServiceResult(true, ServiceErrorType.None, new List<string>());
    }

    public static ServiceResult Failure(ServiceErrorType errorType, string error)
    {
        return new ServiceResult(false, errorType, new List<string> { error });
    }
}

public class ServiceResult<T> : ServiceResult
{
    public T? Value { get; }

    private ServiceResult(T value)
        : base(true, ServiceErrorType.None, new List<string>())
    {
        Value = value;
    }

    private ServiceResult(ServiceErrorType errorType, string error)
        : base(false, errorType, new List<string> { error })
    {
    }

    public static ServiceResult<T> Success(T value)
    {
        return new ServiceResult<T>(value);
    }

    public static new ServiceResult<T> Failure(ServiceErrorType errorType, string error)
    {
        return new ServiceResult<T>(errorType, error);
    }
}