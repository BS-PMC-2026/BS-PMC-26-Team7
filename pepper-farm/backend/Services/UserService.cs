using Microsoft.EntityFrameworkCore;
using PepperFarm.Api.Data;
using PepperFarm.Api.DTOs.Users;

namespace PepperFarm.Api.Services;

public class UserService
{
    private readonly AppDbContext _db;

    public UserService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<UserResponseDto>> GetWorkersAsync()
    {
        return await _db.Users
            .Include(u => u.Role)
            .Where(u => u.Role.RoleName == "Worker" && u.IsActive)
            .Select(u => new UserResponseDto
            {
                UserId = u.UserId,
                FullName = u.FullName,
                Email = u.Email,
                RoleName = u.Role.RoleName,
                IsActive = u.IsActive,
            })
            .ToListAsync();
    }
}
